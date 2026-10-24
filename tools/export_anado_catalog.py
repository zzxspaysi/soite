#!/usr/bin/env python3
"""Read-only ANADO catalog export. Requires httpx, lxml and Pillow.

Keeps original photos, source URLs and original text. Never submits forms.
Cached responses make interrupted runs resumable without repeating downloads.
"""
import argparse
import asyncio
import csv
import gzip
import hashlib
import html as html_std
import io
import json
import re
import ssl
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, unquote

import httpx
import os
from lxml import etree, html
from PIL import Image

BASE = "https://anado.ru/"
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CACHE = ROOT / '.local' / 'export-cache'


def normalized_url(value, base=BASE):
    if not value:
        return None
    p = urlsplit(urljoin(base, html_std.unescape(value.strip())))
    if p.hostname not in {"anado.ru", "www.anado.ru"}:
        return None
    return urlunsplit(("https", "anado.ru", p.path, "", ""))


def safe_external_url(value, base=BASE):
    if not isinstance(value, str) or len(value) > 4096 or re.search(r'[\x00-\x1f\x7f\\]', value):
        return None
    try:
        target = urlsplit(urljoin(base, value))
        if target.scheme not in {'http', 'https'} or not target.hostname or target.username or target.password:
            return None
        return target.geturl()
    except ValueError:
        return None


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def normalize_text(value):
    return " ".join((value or "").replace("\xa0", " ").split())


def text_block(element):
    if element is None:
        return ""
    copy = html.fromstring(html.tostring(element, encoding="unicode"))
    for node in copy.xpath(".//script|.//style|.//noscript|.//iframe"):
        node.drop_tree()
    for node in copy.iter():
        if isinstance(node.tag, str) and node.tag.lower() in {
            "p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "table"
        }:
            node.tail = "\n" + (node.tail or "")
    return "\n".join(
        normalize_text(line) for line in copy.text_content().splitlines()
        if normalize_text(line)
    )


def tab_fragment(raw, identifier):
    # Parse tabs independently: malformed Word HTML on the source website can
    # otherwise swallow later photo tabs, sidebars and even the site footer.
    pattern = r'<dd\b[^>]*\bid=["\']' + re.escape(identifier) + r'["\'][^>]*>(.*?)</dd\s*>'
    match = re.search(pattern, raw, re.I | re.S)
    fragment = match.group(1) if match else ""
    if not fragment.strip():
        return "", html.fromstring("<div></div>")
    try:
        element = html.fragment_fromstring(fragment, create_parent="div")
    except etree.ParserError:
        element = html.fromstring("<div></div>")
    return fragment, element


def safe_html(element):
    element = html.fromstring(html.tostring(element, encoding="unicode"))
    for node in element.xpath(".//script|.//style|.//iframe|.//object|.//embed|.//form|.//meta|.//base|.//link|.//svg|.//math|.//template"):
        node.drop_tree()
    for node in element.iter():
        if not isinstance(node.tag, str):
            continue
        if node.tag.lower() not in {'div','p','br','span','b','strong','i','em','u','s','sub','sup','ul','ol','li','h1','h2','h3','h4','h5','h6','table','thead','tbody','tfoot','tr','td','th','a','img','blockquote','pre','code','hr'}:
            node.drop_tag()
            continue
        for key in list(node.attrib):
            if key.lower() not in {'href','src','title','alt','colspan','rowspan'}:
                del node.attrib[key]
        for attribute in ("href", "src"):
            value = node.get(attribute)
            if value:
                absolute = safe_external_url(value)
                if absolute:
                    node.set(attribute, absolute)
                else:
                    node.attrib.pop(attribute, None)
    return html.tostring(element, encoding="unicode")


def image_url(value):
    url = normalized_url(value)
    if not url:
        return None
    path = urlsplit(url).path.lower()
    if not re.search(r"\.(?:jpg|jpeg|png|gif|webp|bmp)$", path):
        return None
    if any(token in path for token in ["noimage", "no-image", "no_image", "nophoto", "no_photo", "no-photo"]):
        return None
    return url


def parse_product(raw, url):
    tree = html.fromstring(raw)
    titles = tree.xpath("//h1")
    name = normalize_text(titles[0].text_content()) if titles else ""
    if not name or not re.search(r'id=["\']tab-(?:info|params|photos)["\']|class=["\']big-preview', raw):
        raise ValueError("Source page is not a product card")
    description_raw, description = tab_fragment(raw, "tab-info")
    specs_raw, specs = tab_fragment(raw, "tab-params")
    _, photos = tab_fragment(raw, "tab-photos")
    tables = []
    for table in specs.xpath(".//table[not(ancestor::table)]"):
        rows = []
        for row in table.xpath(".//tr"):
            if row.xpath("ancestor::table[1]")[0] is not table:
                continue
            cells = [{"text": text_block(cell), "colspan": int(cell.get("colspan", "1")) if cell.get("colspan", "1").isdigit() else 1,
                      "rowspan": int(cell.get("rowspan", "1")) if cell.get("rowspan", "1").isdigit() else 1}
                     for cell in row.xpath("./th|./td")]
            if any(cell["text"] for cell in cells):
                rows.append(cells)
        if rows:
            tables.append(rows)
    offers = []
    for row in tree.xpath('//table[contains(@class,"items-table-in")]//tr[.//span[starts-with(@id,"title")]]'):
        cells = row.xpath("./td")
        spans = row.xpath('.//span[starts-with(@id,"title")]')
        if not spans or len(cells) < 3:
            continue
        offer_id = re.search(r"\d+", spans[0].get("id", ""))
        prices = row.xpath('.//*[@itemprop="price"]')
        price_text = normalize_text(prices[0].text_content() if prices else cells[2].text_content())
        offers.append({"source_offer_id": offer_id.group() if offer_id else None,
                       "sku": normalize_text(cells[0].text_content()),
                       "name": normalize_text(spans[0].text_content()),
                       "source_price_text": price_text,
                       "currency": "RUB" if "руб" in price_text.lower() else None})
    preview = [u for u in (image_url(v) for v in tree.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," big-preview ")]//img/@src')) if u]
    gallery = [u for u in (image_url(v) for v in photos.xpath(".//a/@href|.//img/@src")) if u]
    # Prefer the linked 500px original over its small gallery thumbnail.
    preferred = [u for u in (image_url(v) for v in photos.xpath(".//a/@href")) if u]
    images = list(dict.fromkeys(preview + preferred + gallery))
    crumbs = []
    for anchor in tree.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," crumbs ")]//a[@href]'):
        category_url = normalized_url(anchor.get("href"), url)
        if category_url and "/products/category/" in category_url:
            crumbs.append({"name": normalize_text(anchor.text_content()), "source_url": category_url})
    documents = []
    for fragment in (description, specs):
        for anchor in fragment.xpath(".//a[@href]"):
            target = safe_external_url(anchor.get("href"), url)
            if target and re.search(r"\.(?:pdf|docx?|xlsx?|zip|rar|7z)(?:$|\?)", target, re.I):
                documents.append({"name": normalize_text(anchor.text_content()) or unquote(urlsplit(target).path.rsplit("/", 1)[-1]), "source_url": target})
    missing = []
    if not text_block(description): missing.append("description_not_provided")
    if not text_block(specs): missing.append("specifications_not_provided")
    if not images: missing.append("photo_not_provided")
    return {"source_url": url, "name": name, "source_breadcrumbs": crumbs,
            "description_text": text_block(description), "description_html": safe_html(description),
            "specifications_text": text_block(specs), "specifications_html": safe_html(specs),
            "specification_tables": tables, "offers": offers,
            "image_urls": images, "primary_image_url": (preview or preferred or images or [None])[0],
            "documents": documents, "missing_fields": missing,
            "source_content_sha256": digest(description_raw + specs_raw),
            "stock": None, "stock_note": "Not inferred from quantity input or source prices."}


class Exporter:
    def __init__(self, args):
        self.args = args
        self.cache = Path(args.cache)
        if len(self.cache.resolve().parts)<3 or self.cache.resolve()==ROOT:
            raise ValueError('Choose a dedicated cache subdirectory')
        if self.cache.is_symlink():
            raise ValueError('Cache directory must not be a symbolic link')
        self.cache.mkdir(parents=True, exist_ok=True, mode=0o700)
        if hasattr(os,'getuid') and self.cache.stat().st_uid != os.getuid():
            raise ValueError('Cache directory must belong to the current user')
        self.cache.chmod(0o700)
        self.output = Path(args.output)
        for path in [self.cache / "html", self.cache / "records", self.output / "products", self.output / "images"]:
            path.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.semaphore = asyncio.Semaphore(args.concurrency)
        self.rate_lock = asyncio.Lock()
        self.next_request = 0.0
        self.stats = Counter()
        self.errors = []
        self.category_pages = []
        self.memberships = defaultdict(set)
        self.category_names = {}
        self.product_urls = set()
        self.started = time.monotonic()

    def log(self, stage, **data):
        print(json.dumps({"stage": stage, "elapsed_seconds": round(time.monotonic() - self.started), **data}, ensure_ascii=False), flush=True)

    async def paced(self):
        async with self.rate_lock:
            delay = self.next_request - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)
            self.next_request = time.monotonic() + 1 / self.args.rate

    async def get(self, url, binary=False):
        url = normalized_url(url)
        if not url:
            raise ValueError('Only ANADO source URLs may be fetched')
        key = self.cache / "html" / (digest(url) + ".gz")
        if not binary and key.exists():
            self.stats["cache_hits"] += 1
            return gzip.decompress(key.read_bytes()), url
        for attempt in range(3):
            try:
                async with self.semaphore:
                    await self.paced()
                    current=url
                    for hop in range(6):
                        if hop:
                            await self.paced()
                        async with self.client.stream('GET',current,follow_redirects=False) as response:
                            self.stats['requests'] += 1
                            if response.is_redirect:
                                target=normalized_url(response.headers.get('location'),current)
                                if not target:raise ValueError('Redirect outside ANADO is not allowed')
                                current=target
                                continue
                            content=bytearray()
                            async for chunk in response.aiter_bytes():
                                if len(content)+len(chunk)>20*1024*1024:raise ValueError('Response larger than 20 MiB')
                                content.extend(chunk)
                            break
                    else:
                        raise ValueError('Too many ANADO redirects')
                if response.status_code in {429, 500, 502, 503, 504} and attempt < 2:
                    await asyncio.sleep(2 ** (attempt + 1))
                    continue
                response.raise_for_status()
                if not binary:
                    key.write_bytes(gzip.compress(bytes(content)))
                return bytes(content), current
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt == 2:
                    raise
                await asyncio.sleep(2 ** (attempt + 1))
        raise RuntimeError("Request failed after transient retries")

    async def category(self, url):
        try:
            content, final_url = await self.get(url)
            tree = html.fromstring(content)
            headings = tree.xpath("//h1")
            if not headings:
                raise ValueError("Category heading missing")
            self.category_names[url] = normalize_text(headings[0].text_content())
            page_links = tree.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," pages ")]//a/@href')
            pages = [int(m.group(1)) for value in page_links if (m := re.search(r"/(\d+)\.html$", value))]
            maximum = max(pages, default=1)
            if maximum > 500:
                raise ValueError("Unexpected pagination greater than 500 pages")
            product_set = set()

            def collect(data, page_url):
                doc = html.fromstring(data)
                links = doc.xpath('//*[@id="table_list"]//a/@href')
                found = {p for value in links if (p := normalized_url(value, page_url)) and "/products/item/" in p}
                product_set.update(found)
                self.product_urls.update(found)
                for product in found:
                    self.memberships[product].add(url)

            collect(content, final_url)
            async def next_page(number):
                page_url = url.rstrip("/") + f"/{number}.html"
                try:
                    data, _ = await self.get(page_url)
                    collect(data, page_url)
                except Exception as error:
                    self.errors.append({"stage": "category_page", "url": page_url, "error": str(error)[:600]})
            await asyncio.gather(*(next_page(number) for number in range(2, maximum + 1)))
            self.category_pages.append({"source_url": url, "name": self.category_names[url], "pages": maximum,
                                        "product_urls": sorted(product_set), "product_count": len(product_set)})
        except Exception as error:
            self.errors.append({"stage": "category", "url": url, "error": str(error)[:600]})
        self.stats["categories_processed"] += 1
        if self.stats["categories_processed"] % 20 == 0:
            self.log("categories", processed=self.stats["categories_processed"], products_discovered=len(self.product_urls), errors=len(self.errors))

    async def product(self, url):
        path = self.cache / "records" / (digest(url) + ".json")
        try:
            if path.exists() and not self.args.reparse:
                product = json.loads(path.read_text())
            else:
                content, final_url = await self.get(url)
                raw = content.decode("utf-8", errors="replace")
                product = parse_product(raw, final_url)
                product["requested_source_url"] = url
                product["captured_at_utc"] = datetime.now(timezone.utc).isoformat()
                path.write_text(json.dumps(product, ensure_ascii=False))
            self.stats["products_ok"] += 1
        except Exception as error:
            self.errors.append({"stage": "product", "url": url, "error": str(error)[:600]})
        self.stats["products_processed"] += 1
        if self.stats["products_processed"] % 100 == 0:
            self.log("products", processed=self.stats["products_processed"], total=self.stats["products_total"], successful=self.stats["products_ok"], errors=len(self.errors))

    async def download_image(self, url):
        suffix = Path(urlsplit(url).path).suffix.lower()
        suffix = suffix if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"} else ".jpg"
        filename = digest(url)[:24] + suffix
        path = self.output / "images" / filename
        try:
            if not path.exists():
                content, _ = await self.get(url, binary=True)
                with Image.open(io.BytesIO(content)) as img:
                    img.verify()
                path.write_bytes(content)
            self.images[url] = "images/" + filename
            self.stats["images_ok"] += 1
        except Exception as error:
            self.errors.append({"stage": "image", "url": url, "error": str(error)[:600]})
        self.stats["images_processed"] += 1
        if self.stats["images_processed"] % 200 == 0:
            self.log("images", processed=self.stats["images_processed"], total=self.stats["images_total"], successful=self.stats["images_ok"], errors=len(self.errors))

    def records(self, urls):
        unique = {}
        for url in urls:
            path = self.cache / "records" / (digest(url) + ".json")
            if not path.exists():
                continue
            product = json.loads(path.read_text())
            key = product["source_url"]
            if key not in unique:
                unique[key] = product
                unique[key]["source_aliases"] = []
                unique[key]["category_urls"] = set()
            item = unique[key]
            item["source_aliases"].append(url)
            item["category_urls"].update(self.memberships[url])
            item["category_urls"].update(c["source_url"] for c in product["source_breadcrumbs"])
        for product in unique.values():
            product["category_urls"] = sorted(product["category_urls"])
            product["id"] = digest(product["source_url"])[:16]
            product["markdown_file"] = "products/" + product["id"] + ".md"
        return sorted(unique.values(), key=lambda p: (p["name"].casefold(), p["source_url"]))

    @staticmethod
    def md(value):
        return (value or "").replace("\\", "\\\\").replace("|", "\\|").replace("[", "\\[").replace("]", "\\]").replace("\n", "<br>")

    def write_product(self, product):
        md = self.md
        lines = ["# " + product["name"], "", f'Источник: {product["source_url"]}', "", "## Категории", ""]
        for url in product["category_urls"]:
            lines.append(f'- [{md(self.category_names.get(url, unquote(urlsplit(url).path)))}]({url})')
        lines += ["", "## Фото", ""]
        if product.get("local_primary_image"):
            lines += [f'![{md(product["name"])}](../{product["local_primary_image"]})', ""]
        if product["image_urls"]:
            lines += [f'- [Фото {i}]({url})' for i, url in enumerate(product["image_urls"], 1)]
        else:
            lines.append("На исходной странице фотография не указана.")
        lines += ["", "## Описание", "", product["description_text"] or "На исходной странице описание не указано.", "", "## Характеристики", ""]
        if product["specification_tables"]:
            for table in product["specification_tables"]:
                count = max(len(row) for row in table)
                labels = ["Параметр", "Значение"] if count == 2 else [f"Колонка {i + 1}" for i in range(count)]
                lines += ["| " + " | ".join(labels) + " |", "| " + " | ".join(["---"] * count) + " |"]
                for row in table:
                    values = [md(cell["text"]) for cell in row]
                    lines.append("| " + " | ".join(values + [""] * (count - len(values))) + " |")
                lines.append("")
            lines += ["<details>", "<summary>Полный текст раздела характеристик</summary>", "", product["specifications_text"], "", "</details>"]
        else:
            lines.append(product["specifications_text"] or "На исходной странице характеристики не указаны.")
        lines += ["", "## Артикулы и комплектации", ""]
        if product["offers"]:
            lines += ["| ID на ANADO | Артикул | Наименование | Цена на исходном сайте |", "| --- | --- | --- | --- |"]
            lines += ["| " + " | ".join(md(str(o.get(k) or "")) for k in ("source_offer_id", "sku", "name", "source_price_text")) + " |" for o in product["offers"]]
            lines += ["", "Цены сохранены на дату выгрузки. Актуальные цены и наличие нового магазина должны поступать из 1С:УТ."]
        else:
            lines.append("Отдельные артикулы или комплектации на странице не указаны.")
        if product["documents"]:
            lines += ["", "## Документы", ""]
            lines += [f'- [{md(d["name"])}]({d["source_url"]})' for d in product["documents"]]
        lines += ["", f'Дата получения (UTC): {product["captured_at_utc"]}', "", "Текст и характеристики перенесены с ANADO. Отсутствующие данные не дополнялись предположениями.", ""]
        (self.output / product["markdown_file"]).write_text("\n".join(lines))

    def finish(self, products, nav):
        index = defaultdict(list)
        totals = Counter()
        offers = []
        with (self.output / "products.jsonl").open("w") as file:
            for product in products:
                product["local_primary_image"] = self.images.get(product["primary_image_url"])
                self.write_product(product)
                file.write(json.dumps(product, ensure_ascii=False) + "\n")
                for category in product["category_urls"]:
                    index[category].append(product)
                totals["offers"] += len(product["offers"])
                totals["with_description"] += bool(product["description_text"])
                totals["with_specifications"] += bool(product["specifications_text"])
                totals["with_image_url"] += bool(product["image_urls"])
                totals["with_local_photo"] += bool(product["local_primary_image"])
                for offer in product["offers"]:
                    offers.append({"product_id": product["id"], "product_name": product["name"], "source_url": product["source_url"], **offer})
        if offers:
            with (self.output / "offers.csv").open("w", encoding="utf-8-sig", newline="") as file:
                writer = csv.DictWriter(file, fieldnames=list(offers[0]))
                writer.writeheader()
                for offer in offers:
                    writer.writerow({k: ("'" + v if isinstance(v, str) and v.startswith(("=", "+", "-", "@")) else v) for k, v in offer.items()})
        report = {"source": BASE, "finished_at_utc": datetime.now(timezone.utc).isoformat(), "products": len(products),
                  "discovered_product_urls": len(self.product_urls), "processed_product_urls": self.stats["products_processed"],
                  "downloaded_unique_photos": len(self.images), **dict(totals), "stats": dict(self.stats), "errors": self.errors,
                  "category_pages": sorted(self.category_pages, key=lambda c: c["source_url"])}
        (self.output / "export-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        (self.output / "image-manifest.json").write_text(json.dumps(self.images, ensure_ascii=False, indent=2))
        lines = ["# Товары ANADO: полный индекс выгрузки", "", f'Карточек: **{len(products)}**. Артикулов/комплектаций: **{totals["offers"]}**. Карточек с сохранённым главным фото: **{totals["with_local_photo"]}**.', "",
                 "В каждой карточке — источник, категории, фото, исходное описание, характеристики и варианты поставки. Исходные формулировки сохранены; отсутствующие сведения отмечены явно.", "",
                 "[Данные для импорта — JSONL](products.jsonl) · [Артикулы — CSV](offers.csv) · [Отчёт выгрузки](export-report.json)", ""]
        included = set()

        def category_section(node, level):
            url = node["source_url"]
            included.add(url)
            items = index[url]
            lines.extend(["#" * min(level, 6) + " " + node["name"], "", f'Источник категории: {url}', "", f'Карточек в выгрузке: {len(items)}.', ""])
            for product in items:
                lines.append(f'- [{self.md(product["name"])}]({product["markdown_file"]})')
            lines.append("")
            for child in node["children"]:
                category_section(child, level + 1)
        for node in nav["categories"]:
            category_section(node, 2)
        extra = sorted(set(index) - included)
        if extra:
            lines.extend(["## Дополнительные категории из карты сайта и карточек ANADO", "", "Эти адреса не входили в исходные 19 разделов меню. Они сохранены отдельно для сверки, без изменения исходного дерева.", ""])
            for url in extra:
                lines += ["### " + self.category_names.get(url, unquote(urlsplit(url).path)), "", f'Источник: {url}', ""]
                lines += [f'- [{self.md(p["name"])}]({p["markdown_file"]})' for p in index[url]]
                lines.append("")
        uncategorized = [p for p in products if not p["category_urls"]]
        if uncategorized:
            lines += ["## Карточки без указанной категории", ""]
            lines += [f'- [{self.md(p["name"])}]({p["markdown_file"]})' for p in uncategorized]
        (self.output / "INDEX.md").write_text("\n".join(lines) + "\n")
        summary = {k: v for k, v in report.items() if k not in {"category_pages", "errors"}}
        summary["error_count"] = len(self.errors)
        self.log("complete", **summary)

    async def run(self):
        nav = json.loads((ROOT / "data/anado-categories.json").read_text())
        def walk(nodes):
            for node in nodes:
                self.category_names[node["source_url"]] = node["name"]
                yield node["source_url"]
                yield from walk(node["children"])
        categories = set(walk(nav["categories"]))
        limits = httpx.Limits(max_connections=self.args.concurrency, max_keepalive_connections=self.args.concurrency)
        async with httpx.AsyncClient(verify=ssl.create_default_context(), follow_redirects=True, timeout=httpx.Timeout(35),
                                     limits=limits, headers={"User-Agent": "ANADO-Catalog-Migration/1.0", "Accept": "text/html,application/xml,image/*"}) as client:
            self.client = client
            raw, _ = await self.get(urljoin(BASE, "sitemap.xml"))
            sitemap = etree.fromstring(raw, parser=etree.XMLParser(resolve_entities=False, no_network=True))
            urls = {normalized_url(value) for value in sitemap.xpath('//*[local-name()="loc"]/text()')}
            self.product_urls.update(u for u in urls if u and "/products/item/" in u)
            additional = self.output / "additional-discovery.json"
            if additional.exists():
                self.product_urls.update(json.loads(additional.read_text()).get("urls", []))
            categories.update(u for u in urls if u and "/products/category/" in u)
            self.log("discovery", sitemap_products=len(self.product_urls), categories=len(categories))
            if not self.args.limit:
                await asyncio.gather(*(self.category(url) for url in sorted(categories)))
            product_urls = sorted(self.product_urls)
            if self.args.limit:
                product_urls = product_urls[:self.args.limit]
            self.stats["products_total"] = len(product_urls)
            self.log("product_start", total=len(product_urls), categories_processed=self.stats["categories_processed"])
            await asyncio.gather(*(self.product(url) for url in product_urls))
            products = self.records(product_urls)
            self.images = {}
            if not self.args.skip_images:
                images = sorted({p["primary_image_url"] for p in products if p["primary_image_url"]})
                self.stats["images_total"] = len(images)
                self.log("image_start", total=len(images))
                await asyncio.gather(*(self.download_image(url) for url in images))
            self.finish(products, nav)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=str(ROOT / "catalog"))
    parser.add_argument("--cache", default=str(DEFAULT_CACHE))
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--rate", type=float, default=8)
    parser.add_argument("--limit", type=int, default=0, help="Sample mode; skips category traversal")
    parser.add_argument("--skip-images", action="store_true")
    parser.add_argument("--reparse", action="store_true", help="Reparse cached source HTML with the current parser")
    args = parser.parse_args()
    if not 1 <= args.concurrency <= 6 or not 0 < args.rate <= 10:
        parser.error("Use concurrency 1..6 and request rate up to 10/s")
    asyncio.run(Exporter(args).run())


if __name__ == "__main__":
    main()
