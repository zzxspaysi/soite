#!/usr/bin/env python3
"""Create a searchable offline HTML view of the downloaded ANADO export."""
import html
import json
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "catalog"

CSS = """
:root{font-family:Arial,sans-serif;color:#20212a;background:#f0f1f5;line-height:1.55}
*{box-sizing:border-box}body{margin:0}a{color:#ba1631;text-decoration:none}a:hover{text-decoration:underline}
header{background:#171923;color:white;padding:24px max(24px,calc((100vw - 1240px)/2));display:flex;gap:24px;align-items:center;justify-content:space-between}
header a{color:white}.brand{font-size:26px;font-weight:800;letter-spacing:1px}main{max-width:1288px;margin:auto;padding:28px 24px 64px}
h1{font-size:clamp(26px,4vw,42px);line-height:1.15;overflow-wrap:anywhere}h2{font-size:24px;margin-top:36px}
.muted{color:#646877}.intro{max-width:900px}.controls{background:white;padding:20px;border-radius:16px;display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}
label{display:flex;flex-direction:column;gap:6px;font-size:14px;flex:1;min-width:240px}input,select{font:inherit;padding:12px;border:1px solid #c5c8d3;border-radius:8px;width:100%;background:white;color:#20212a}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:18px}.card{background:white;border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.card img,.placeholder{width:100%;height:190px;object-fit:contain;background:white;padding:16px}.placeholder{display:grid;place-items:center;color:#737789;background:#e3e5ec}
.card-body{padding:18px;display:flex;flex-direction:column;flex:1}.card h2{font-size:18px;margin:0 0 8px;line-height:1.35}.card .muted{font-size:13px;margin-bottom:12px}
.open{display:inline-block;background:#cf1739;color:white;border-radius:8px;padding:9px 14px;margin-top:auto;align-self:flex-start}.open:hover{color:white}
button{font:inherit;padding:12px 20px;background:#cf1739;border:0;border-radius:8px;color:white;cursor:pointer}button:disabled{opacity:.5;cursor:default}.more{display:block;margin:28px auto}
.product-top{display:grid;grid-template-columns:40% 1fr;gap:28px}.photo{background:white;border-radius:16px;padding:24px;align-self:start;text-align:center}.photo img{max-width:100%;max-height:420px;object-fit:contain}
.panel{background:white;padding:24px;border-radius:16px;margin:20px 0;overflow:auto}.panel h2:first-child{margin-top:0}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:12px;border-bottom:1px solid #dfe2eb;vertical-align:top;min-width:90px}th{background:#f1f2f7}
.specs td:first-child{font-weight:600}p,td,li{overflow-wrap:anywhere}.note{border-left:3px solid #cf1739;padding-left:14px}.tags{display:flex;gap:8px;flex-wrap:wrap}.tags a{background:white;border-radius:6px;padding:6px 10px;font-size:13px}
footer{max-width:1240px;margin:auto;padding:12px 24px 32px;color:#646877;font-size:13px}small{font-size:13px}
@media(max-width:700px){header{padding:18px 20px;align-items:flex-start;flex-direction:column;gap:8px}main{padding:20px 16px 40px}.product-top{grid-template-columns:1fr}.panel{padding:16px}.photo img{max-height:280px}.grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}}
@media print{header,.controls,.more{display:none}body{background:white}main{max-width:100%}.panel{border:1px solid #ddd}.product-top{grid-template-columns:30% 1fr}a{color:inherit}}
"""


def esc(value):
    return html.escape(str(value or ""), quote=True)


def paragraphs(text, fallback):
    return "".join("<p>" + esc(line) + "</p>" for line in (text or fallback).splitlines() if line.strip())


def shell(title, content, nested=False):
    prefix = "../" if nested else ""
    return f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title><link rel="stylesheet" href="{prefix}assets/catalog.css"></head>
<body><header><a class="brand" href="{prefix}index.html">ANADO</a><span>Выгрузка каталога для переноса на новый сайт</span></header>
<main>{content}</main><footer>Материалы с anado.ru. Цены — снимок исходного сайта, наличие по ним не определяется.</footer></body></html>'''


def product_page(product, category_names):
    tags = "".join(f'<a href="../index.html?category={esc(url)}">{esc(category_names.get(url, url))}</a>' for url in product["category_urls"])
    if product.get("local_primary_image"):
        photo = f'<img src="../{esc(product["local_primary_image"])}" alt="{esc(product["name"])}">'
    else:
        photo = '<div class="placeholder">Фото не сохранено</div>'
    image_links = "".join(f'<li><a href="{esc(url)}" target="_blank" rel="noreferrer">Фото {i} на исходном сайте</a></li>' for i, url in enumerate(product["image_urls"], 1))
    content = f'''<a href="../index.html">← Весь каталог</a><h1>{esc(product["name"])}</h1><div class="tags">{tags}</div>
<div class="product-top"><section class="photo">{photo}<ul>{image_links}</ul></section>
<section><h2>Описание</h2>{paragraphs(product["description_text"], "Описание на исходной странице не указано.")}
<p><a href="{esc(product["source_url"])}" target="_blank" rel="noreferrer">Оригинальная карточка ANADO</a></p>
<p class="muted">Получено: {esc(product["captured_at_utc"][:10])}</p></section></div>'''
    content += '<section class="panel"><h2>Характеристики</h2>'
    if product["specification_tables"]:
        for table in product["specification_tables"]:
            content += '<table class="specs"><tbody>'
            for row in table:
                content += "<tr>" + "".join("<td>" + esc(cell["text"]).replace("\n", "<br>") + "</td>" for cell in row) + "</tr>"
            content += "</tbody></table>"
        content += '<details><summary>Полный текст исходного раздела характеристик</summary>' + paragraphs(product["specifications_text"], "") + "</details>"
    else:
        content += paragraphs(product["specifications_text"], "Характеристики на исходной странице не указаны.")
    content += '</section><section class="panel"><h2>Артикулы и комплектации</h2>'
    if product["offers"]:
        content += '<table><thead><tr><th>ID ANADO</th><th>Артикул</th><th>Наименование</th><th>Исходная цена</th></tr></thead><tbody>'
        for offer in product["offers"]:
            content += "<tr>" + "".join("<td>" + esc(offer.get(key)) + "</td>" for key in ["source_offer_id", "sku", "name", "source_price_text"]) + "</tr>"
        content += '</tbody></table><p class="note">Цены сохранены на дату выгрузки. Актуальные цены и наличие нового магазина должны поступать из 1С:УТ.</p>'
    else:
        content += "<p>Отдельные артикулы или комплектации на странице не указаны.</p>"
    content += "</section>"
    if product["documents"]:
        content += '<section class="panel"><h2>Документы</h2><ul>' + "".join(f'<li><a href="{esc(doc["source_url"])}">{esc(doc["name"])}</a></li>' for doc in product["documents"]) + "</ul></section>"
    return shell(product["name"], content, nested=True)


def main(products=None, report=None):
    if products is None:
        with (OUT / "products.jsonl").open() as source:
            products = [json.loads(line) for line in source]
    if report is None:
        report = json.loads((OUT / "export-report.json").read_text())
    nav = json.loads((ROOT / "data/anado-categories.json").read_text())
    category_names = {c["source_url"]: c["name"] for c in report["category_pages"]}
    category_names.update(report.get("category_names", {}))
    options = ['<option value="">Все категории</option>']
    known = set()
    for root in nav["categories"]:
        category_names[root["source_url"]] = root["name"]
        known.add(root["source_url"])
        options.append(f'<optgroup label="{esc(root["name"])}"><option value="{esc(root["source_url"])}">{esc(root["name"])} — весь раздел</option>')
        for child in root["children"]:
            category_names[child["source_url"]] = child["name"]
            known.add(child["source_url"])
            options.append(f'<option value="{esc(child["source_url"])}">{esc(child["name"])}</option>')
        options.append("</optgroup>")
    extra = sorted({url for p in products for url in p["category_urls"]} - known)
    if extra:
        options.append('<optgroup label="Дополнительные категории из ANADO">')
        options.extend(f'<option value="{esc(url)}">{esc(category_names.get(url, url))}</option>' for url in extra)
        options.append("</optgroup>")
    data = []
    for p in products:
        (OUT / "products" / (p["id"] + ".html")).write_text(product_page(p, category_names))
        data.append({"id": p["id"], "name": p["name"], "categories": p["category_urls"],
                     "photo": p.get("local_primary_image"), "offers": len(p["offers"]),
                     "hasDescription": bool(p["description_text"]), "hasSpecs": bool(p["specifications_text"]),
                     "search": " ".join([p["name"], *[o["sku"] for o in p["offers"]]]).lower()})
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    content = f'''<h1>Каталог ANADO</h1><p class="intro">{len(products):,} карточек товаров · {report["offers"]:,} артикулов и комплектаций · {report["with_local_photo"]:,} карточек с сохранённым фото.</p>
<p class="muted">Описания, характеристики и фотографии перенесены с ANADO. Пропуски исходного сайта отмечены в карточках.</p>
<div class="controls"><label>Поиск по названию или артикулу<input id="search" type="search" placeholder="Например: АТОЛ, принтер, артикул" autocomplete="off"></label>
<label>Категория<select id="category">{"".join(options)}</select></label><label>Заполненность<select id="quality"><option value="">Все карточки</option><option value="description">Без описания</option><option value="specs">Без характеристик</option><option value="photo">Без сохранённого фото</option></select></label></div><p id="count" aria-live="polite"></p><div id="results" class="grid"></div><button id="more" class="more" type="button">Показать ещё</button>
<p><a href="INDEX.md">Дерево каталога</a> · <a href="offers.csv">Артикулы CSV</a> · <a href="products.jsonl">Данные JSONL</a> · <a href="export-report.json">Отчёт выгрузки</a></p>
<script type="application/json" id="catalog-data">{encoded}</script><script src="assets/catalog.js"></script>'''
    assets = OUT / "assets"
    assets.mkdir(exist_ok=True)
    (assets / "catalog.css").write_text(CSS)
    (assets / "catalog.js").write_text('''"use strict";
const data=JSON.parse(document.getElementById("catalog-data").textContent);
const search=document.getElementById("search"), category=document.getElementById("category"), quality=document.getElementById("quality"), results=document.getElementById("results"), count=document.getElementById("count"), more=document.getElementById("more");
let matching=data, shown=0;
const params=new URLSearchParams(location.search); search.value=params.get("q")||"";category.value=params.get("category")||"";
function add(){const fragment=document.createDocumentFragment();for(const p of matching.slice(shown,shown+80)){const article=document.createElement("article");article.className="card";if(p.photo){const img=document.createElement("img");img.src=p.photo;img.alt=p.name;img.loading="lazy";article.append(img);}else{const div=document.createElement("div");div.className="placeholder";div.textContent="Фото не сохранено";article.append(div);}const body=document.createElement("div");body.className="card-body";const title=document.createElement("h2");title.textContent=p.name;const note=document.createElement("div");note.className="muted";note.textContent=p.offers+" артикулов / комплектаций";const link=document.createElement("a");link.className="open";link.href="products/"+p.id+".html";link.textContent="Открыть карточку";body.append(title,note,link);article.append(body);fragment.append(article);}results.append(fragment);shown=Math.min(shown+80,matching.length);count.textContent="Найдено: "+matching.length+". Показано: "+shown+".";more.hidden=shown>=matching.length;}
function filter(){const words=search.value.toLowerCase().trim().split(/\\s+/).filter(Boolean),cat=category.value,q=quality.value;matching=data.filter(p=>(!cat||p.categories.includes(cat))&&words.every(w=>p.search.includes(w))&&(!q||(q==="description"&&!p.hasDescription)||(q==="specs"&&!p.hasSpecs)||(q==="photo"&&!p.photo)));shown=0;results.replaceChildren();add();}
let timer;search.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(filter,120);});category.addEventListener("change",filter);quality.addEventListener("change",filter);more.addEventListener("click",add);filter();
''')
    (OUT / "index.html").write_text(shell("Каталог ANADO — выгрузка", content))
    missing = []
    for p in products:
        if not p["description_text"] or not p["specifications_text"] or not p.get("local_primary_image"):
            missing.append({"name": p["name"], "source_url": p["source_url"],
                            "missing_description": not bool(p["description_text"]),
                            "missing_specifications": not bool(p["specifications_text"]),
                            "missing_local_photo": not bool(p.get("local_primary_image")),
                            "card": p["markdown_file"]})
    with (OUT / "MISSING_DATA.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["name", "source_url", "missing_description", "missing_specifications", "missing_local_photo", "card"])
        writer.writeheader(); writer.writerows(missing)
    with (OUT / "UNAVAILABLE_PAGES.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["stage", "url", "error"])
        writer.writeheader(); writer.writerows(report["errors"])
    readme = f'''# Выгрузка каталога ANADO

Источник всех товаров: https://anado.ru/. Это материалы для переноса на новый сайт.

Сохранено {len(products)} карточек, {report["offers"]} артикулов/комплектаций. У {report["with_local_photo"]} карточек есть локальное главное фото.

## Как посмотреть

Откройте `index.html` в браузере. Работают поиск по названию и артикулу, выбор категории и фильтр незаполненных карточек. Нажмите «Открыть карточку», чтобы увидеть фото, описание, характеристики и комплектации. Дополнительные фотографии и документы доступны по исходным ссылкам.

`INDEX.md` — дерево исходных категорий ANADO со ссылками на отдельные карточки Markdown. Одна карточка содержит все опубликованные в ней артикулы и комплектации; она может быть связана с несколькими разделами, но её файл хранится в одном экземпляре.

## Для импорта

- `products.jsonl`: один JSON-объект на строку; оригинальные названия, категории, описания в тексте и HTML, характеристики и таблицы с объединениями ячеек, варианты, исходные ссылки и пути фотографий.
- `offers.csv`: таблица артикулов и комплектаций; связана с карточкой через `product_id`. UTF-8 с BOM для открытия в Excel.
- `images/`: главные фотографии в исходном формате, без изменения изображения.
- `products/`: отдельные карточки в Markdown и HTML.
- `image-manifest.json`: соответствие исходного URL фотографии локальному файлу.

## Полнота данных

Описание имеется у {report["with_description"]} карточек; характеристики — у {report["with_specifications"]}. Отсутствующие сведения не придумывались.

- `MISSING_DATA.csv`: перечень карточек с пропусками исходных данных или без сохранённого фото.
- `UNAVAILABLE_PAGES.csv`: недоступные страницы и изображения. Устаревшие ссылки карты сайта сохранены в отчёте.
- `export-report.json`: статистика, результаты обхода категорий и полный перечень ошибок.

В карте сайта встречаются дополнительные и старые категории, отсутствующие в основном меню. Они вынесены в отдельный раздел индекса; исходное дерево из 19 разделов не перегруппировано.

Цены сохранены как исходный текст на дату выгрузки. Поля количества в форме покупки не интерпретировались как остатки. Актуальные цены и наличие нового магазина должны поступать из 1С:УТ.
'''
    (OUT / "README.md").write_text(readme)
    print(json.dumps({"html_product_pages": len(products), "index": str(OUT / "index.html"), "index_bytes": (OUT / "index.html").stat().st_size}))


if __name__ == "__main__":
    main()
