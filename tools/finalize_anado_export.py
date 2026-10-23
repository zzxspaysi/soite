#!/usr/bin/env python3
"""Validate, finish the browser view, and package the ANADO catalog export."""
import argparse
import asyncio
import gzip
import hashlib
import io
import json
import ssl
import zipfile
import csv
from collections import Counter
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit, unquote

import httpx
from PIL import Image

import build_catalog_view
from export_anado_catalog import Exporter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "catalog"


async def fill_missing_photos(products, manifest):
    candidates = [p for p in products if not p.get("local_primary_image") and p["image_urls"]]
    print(json.dumps({"stage": "photo_fallback", "cards": len(candidates)}), flush=True)
    args = SimpleNamespace(cache="/tmp/anado-export-cache", output=str(OUT), concurrency=3, rate=4)
    exporter = Exporter(args)
    exporter.images = manifest
    async with httpx.AsyncClient(verify=ssl.create_default_context(), follow_redirects=True,
                                 timeout=30, limits=httpx.Limits(max_connections=3),
                                 headers={"User-Agent": "ANADO-Catalog-Migration/1.0"}) as client:
        exporter.client = client
        async def fallback(product):
            for url in product["image_urls"]:
                # The failed primary was already attempted by the main export.
                # Test other real gallery URLs instead of repeating that request.
                if url == product["primary_image_url"]:
                    continue
                if url not in manifest:
                    await exporter.download_image(url)
                if url in manifest:
                    product["local_primary_image"] = manifest[url]
                    product["downloaded_primary_source_url"] = url
                    return
        await asyncio.gather(*(fallback(product) for product in candidates))
    return exporter.errors


def validate(products, report, manifest):
    ids = [p["id"] for p in products]
    urls = [p["source_url"] for p in products]
    if len(ids) != len(set(ids)) or len(urls) != len(set(urls)):
        raise ValueError("Duplicate product IDs or canonical URLs")
    if report["processed_product_urls"] != report["discovered_product_urls"]:
        raise ValueError("Export has not attempted all discovered product URLs")
    for product in products:
        if not product["name"] or not product["source_url"].startswith("https://anado.ru/products/item/"):
            raise ValueError("Invalid product identity")
        for field in ["description_text", "specifications_text"]:
            if "Все права защищены ©" in product[field]:
                raise ValueError("Site footer leaked into product content: " + product["source_url"])
        if not (OUT / product["markdown_file"]).is_file():
            raise ValueError("Missing Markdown card: " + product["id"])
        for document in product["documents"]:
            if urlsplit(document["source_url"]).scheme not in {"http", "https"}:
                raise ValueError("Unsupported document link")
    bad_images = []
    for relative in set(manifest.values()):
        path = OUT / relative
        try:
            with Image.open(path) as image:
                image.verify()
        except Exception as error:
            bad_images.append((relative, str(error)))
    if bad_images:
        raise ValueError("Invalid saved images: " + repr(bad_images[:10]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-fallback", action="store_true")
    parser.add_argument("--skip-zip", action="store_true")
    args = parser.parse_args()
    with (OUT / "products.jsonl").open() as source:
        products = [json.loads(line) for line in source]
    report = json.loads((OUT / "export-report.json").read_text())
    manifest = json.loads((OUT / "image-manifest.json").read_text())
    # Include accessible products found through links inside other source pages.
    # Some of these URLs are aliases of cards already exported.
    additional_data = Path("/tmp/anado-additional-discovery.json")
    additional_records = Path("/tmp/anado-additional-products.json")
    new_cards = []
    if additional_data.exists() and additional_records.exists():
        discovery = json.loads(additional_data.read_text())
        prior = set(report.get("additional_linked_urls_processed", []))
        current = set(discovery["urls"])
        new_urls = current - prior
        if new_urls:
            by_url = {p["source_url"]: p for p in products}
            for extra in json.loads(additional_records.read_text()):
                if extra["source_url"] in by_url:
                    original = by_url[extra["source_url"]]
                    original["source_aliases"] = sorted(set(original["source_aliases"] + extra["source_aliases"]))
                    original["category_urls"] = sorted(set(original["category_urls"] + extra["category_urls"]))
                else:
                    by_url[extra["source_url"]] = extra
                    new_cards.append(extra)
            products = sorted(by_url.values(), key=lambda p: (p["name"].casefold(), p["source_url"]))
            report["discovered_product_urls"] += len(new_urls)
            report["processed_product_urls"] += len(new_urls)
            report["products"] = len(products)
            report["errors"].extend(discovery["errors"])
            report["additional_linked_urls_processed"] = sorted(prior | current)
            report["additional_discovery_note"] = "Public product links from source pages; aliases deduplicated by final URL."
            manifest.update(discovery["images"])
            (OUT / "additional-discovery.json").write_text(json.dumps(discovery, ensure_ascii=False, indent=2))
    # Materialize new Markdown cards before the completeness validation below.
    initial_writer = Exporter(SimpleNamespace(cache="/tmp/anado-export-cache", output=str(OUT), concurrency=1, rate=1))
    for product in new_cards:
        initial_writer.write_product(product)
    validate(products, report, manifest)
    if not args.skip_fallback:
        extra_errors = asyncio.run(fill_missing_photos(products, manifest))
        report["errors"].extend(extra_errors)
    args_md = SimpleNamespace(cache="/tmp/anado-export-cache", output=str(OUT), concurrency=1, rate=1)
    writer = Exporter(args_md)
    writer.category_names = {c["source_url"]: c["name"] for c in report["category_pages"]}
    for product in products:
        for category in product["source_breadcrumbs"]:
            writer.category_names.setdefault(category["source_url"], category["name"])
    report["category_names"] = writer.category_names
    for product in products:
        writer.write_product(product)
    with (OUT / "offers.csv").open("w", encoding="utf-8-sig", newline="") as file:
        keys = ["product_id", "product_name", "source_url", "source_offer_id", "sku", "name", "source_price_text", "currency"]
        csv_writer = csv.DictWriter(file, fieldnames=keys)
        csv_writer.writeheader()
        for product in products:
            for offer in product["offers"]:
                row = {"product_id": product["id"], "product_name": product["name"], "source_url": product["source_url"], **offer}
                csv_writer.writerow({k: ("'" + v if isinstance(v, str) and v.startswith(("=", "+", "-", "@")) else v) for k, v in row.items()})
    totals = Counter()
    offer_ids = set()
    for product in products:
        totals["offers"] += len(product["offers"])
        totals["with_description"] += bool(product["description_text"])
        totals["with_specifications"] += bool(product["specifications_text"])
        totals["with_image_url"] += bool(product["image_urls"])
        totals["with_local_photo"] += bool(product.get("local_primary_image"))
        offer_ids.update(o["source_offer_id"] for o in product["offers"] if o["source_offer_id"])
    report.update(dict(totals))
    report["unique_source_offer_ids"] = len(offer_ids)
    report["downloaded_unique_photos"] = len(manifest)
    report["product_source_aliases"] = sum(len(p["source_aliases"]) for p in products)
    nav = json.loads((ROOT / "data/anado-categories.json").read_text())
    def urls(nodes):
        for n in nodes:
            yield n["source_url"]
            yield from urls(n["children"])
    navigation = set(urls(nav["categories"]))
    checked = {c["source_url"] for c in report["category_pages"]}
    report["navigation_categories_total"] = len(navigation)
    report["navigation_categories_successful"] = len(navigation & checked)
    report["navigation_categories_unavailable"] = sorted(navigation - checked)
    report["errors_by_stage"] = dict(Counter(e["stage"] for e in report["errors"]))
    report["product_failures"] = [e for e in report["errors"] if e["stage"] == "product"]
    with (OUT / "products.jsonl").open("w") as target:
        for product in products:
            target.write(json.dumps(product, ensure_ascii=False) + "\n")
    (OUT / "image-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    (OUT / "export-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    index_path = OUT / "INDEX.md"
    index_text = index_path.read_text()
    if new_cards:
        for product in new_cards:
            link = f'- [{writer.md(product["name"])}]({product["markdown_file"]})'
            linked = False
            for category in product["category_urls"]:
                needle = f'Источник категории: {category}\n\nКарточек в выгрузке: '
                position = index_text.find(needle)
                if position < 0:
                    continue
                count_start = position + len(needle)
                count_end = index_text.find('.', count_start)
                number = int(index_text[count_start:count_end]) + 1
                index_text = index_text[:count_start] + str(number) + index_text[count_end:]
                insertion = index_text.find('\n\n', count_start) + 2
                index_text = index_text[:insertion] + link + '\n' + index_text[insertion:]
                linked = True
            if not linked:
                index_text += f'\n### Дополнительно найденная карточка: {product["name"]}\n\n{link}\n'
    for url, name in writer.category_names.items():
        old_heading = "### " + unquote(urlsplit(url).path) + "\n\nИсточник: " + url
        index_text = index_text.replace(old_heading, "### " + name + "\n\nИсточник: " + url)
    index_lines = index_text.splitlines()
    for position, line in enumerate(index_lines):
        if line.startswith("Карточек: **"):
            index_lines[position] = f'Карточек: **{len(products)}**. Артикулов/комплектаций: **{totals["offers"]}**. Карточек с сохранённым главным фото: **{totals["with_local_photo"]}**.'
            break
    index_text = "\n".join(index_lines) + "\n"
    index_path.write_text(index_text)
    build_catalog_view.main(products=products, report=report)
    # Keep the original category tree while linking to all exported cards.
    for name in ["CATALOG_ANADO.md"]:
        path = ROOT / name
        text = path.read_text()
        marker = "## Товарные карточки и фотографии"
        if marker in text:
            text = text.split(marker)[0].rstrip() + "\n"
        text += f'''\n{marker}\n
Выгрузка: **{len(products)} карточек** и **{len(offer_ids)} уникальных ID артикулов/комплектаций**. У **{totals["with_local_photo"]} карточек** сохранено главное фото.

- [Просмотр с поиском в браузере](catalog/index.html).
- [Дерево категорий со ссылками на карточки](catalog/INDEX.md).
- [Описание форматов и полноты данных](catalog/README.md).
- [Исходные данные для импорта](catalog/products.jsonl).
- [Артикулы и комплектации](catalog/offers.csv).
'''
        path.write_text(text)
    structure_path = ROOT / "SITE_STRUCTURE.md"
    structure = structure_path.read_text()
    structure = structure.replace("Категории ANADO зафиксированы; новый сайт, товарные карточки, онлайн-оплата и обмен с 1С ещё не реализованы.",
                                  "Категории и доступные товарные карточки ANADO выгружены отдельно; новый сайт, онлайн-оплата и обмен с 1С ещё не реализованы.")
    structure = structure.replace("Фиксация структуры категорий завершена. Все товарные карточки пока не выгружены и не перенесены.",
                                  f"Структура категорий и {len(products)} доступных карточек выгружены в [catalog/INDEX.md](catalog/INDEX.md). Включены описания, характеристики, артикулы и фотографии, доступные на исходных страницах. Пропуски и недоступные ссылки отражены в отчёте; импорт в новый сайт ещё не выполнен.")
    structure = structure.replace("Для переноса всего каталога требуется получить исходную выгрузку ANADO либо обойти все страницы каждой категории с учётом пагинации.",
                                  "Для выгрузки выполнен обход карты сайта, категорий и их пагинации. Для переноса на новую платформу используются сохранённые данные; недоступные исходные карточки требуют дополнительной выгрузки или уточнения у владельца.")
    structure = structure.replace("На текущем этапе проверено извлечение исходного меню ANADO; перенос всех товаров, разработка интерфейса и работа интеграций ещё не выполнялись.",
                                  "На текущем этапе выполнена выгрузка доступного публичного каталога и подготовлен локальный просмотр. Импорт на новую платформу, разработка магазина и работа интеграций ещё не выполнялись.")
    structure_path.write_text(structure)
    (ROOT / "README_CATALOG.md").write_text('''# Каталог ANADO для нового сайта

Распакуйте архив и откройте **catalog/index.html** в браузере. Для просмотра сохранённых главных фотографий подключение к интернету не требуется. Дополнительные фото и документы даны ссылками на исходный сайт.

- **catalog/INDEX.md** — полное дерево категорий с товарными карточками.
- **catalog/README.md** — форматы файлов и полнота данных.
- **catalog/products.jsonl** — описания, характеристики, фото и комплектации для импорта.
- **catalog/offers.csv** — артикулы и комплектации для Excel и сопоставления с 1С.
- **catalog/MISSING_DATA.csv** — карточки с пропусками.
- **catalog/UNAVAILABLE_PAGES.csv** — недоступные исходные страницы и фотографии.

Каталог и все сведения о товарах взяты с ANADO. Визуальный образец будущего магазина — ATOL. Это выгрузка материалов; оплата и обмен с 1С ещё не подключены.
''')
    validate(products, report, manifest)
    if not args.skip_zip:
        archive = ROOT / "anado-catalog.zip"
        files = [p for p in OUT.rglob("*") if p.is_file() and not p.name.endswith("-part")]
        files += [ROOT / n for n in ["README_CATALOG.md", "CATALOG_ANADO.md", "SITE_STRUCTURE.md", "data/anado-categories.json",
                                     "tools/export_anado_catalog.py", "tools/build_catalog_view.py", "tools/finalize_anado_export.py"]]
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zipped:
            for path in sorted(files):
                compression = zipfile.ZIP_STORED if path.parent == OUT / "images" else zipfile.ZIP_DEFLATED
                zipped.write(path, path.relative_to(ROOT), compress_type=compression)
        with zipfile.ZipFile(archive) as zipped:
            if zipped.testzip() is not None:
                raise ValueError("Archive failed integrity verification")
        print(json.dumps({"archive": str(archive), "bytes": archive.stat().st_size, "files": len(files)}), flush=True)
    print(json.dumps({k: v for k, v in report.items() if k not in {"category_pages", "errors", "product_failures", "category_names"}}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
