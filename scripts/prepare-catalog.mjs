import {
  createReadStream,
  readFileSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { createInterface } from "node:readline";
if (
  !existsSync("catalog/products.jsonl") &&
  existsSync("data/catalog-demo.sqlite.gz")
) {
  await import("./prepare-demo.mjs");
}
const { db, categoryId } = await import("../lib/db.mjs");

const root = JSON.parse(readFileSync("data/anado-categories.json", "utf8"));
const insertCategory = db.prepare(
  "INSERT OR REPLACE INTO categories VALUES(?,?,?,?,?)",
);
let position = 0;
function categories(items, parent = null) {
  for (const c of items) {
    const id = categoryId(c.source_url);
    insertCategory.run(id, c.name, parent, position++, c.source_url);
    categories(c.children || [], id);
  }
}
categories(root.categories);
if (!existsSync("public/media"))
  symlinkSync("../catalog/images", "public/media", "dir");
const count = db.prepare("SELECT count(*) n FROM products").get().n;
if (count === 5756 && !process.argv.includes("--force")) {
  console.log(
    `Catalog ready: ${count} cards. Existing orders and synchronized prices preserved.`,
  );
  process.exit(0);
}
if (count && !process.argv.includes("--force"))
  throw new Error(
    "Incomplete catalog. Run npm run prepare:catalog -- --force to finish importing; orders are preserved.",
  );
const insertProduct = db.prepare(
  "INSERT OR REPLACE INTO products VALUES(?,?,?,?,?,?,?,?,?,?)",
);
const insertOffer = db.prepare(
  "INSERT INTO offers(id,product_id,sku,name,price,source_price) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id,sku=excluded.sku,name=excluded.name,source_price=excluded.source_price",
);
const insertRelation = db.prepare(
  "INSERT OR IGNORE INTO product_categories VALUES(?,?)",
);
db.exec("BEGIN IMMEDIATE; DELETE FROM search;");
let n = 0,
  offers = 0;
try {
  for await (const line of createInterface({
    input: createReadStream("catalog/products.jsonl"),
    crlfDelay: Infinity,
  })) {
    if (!line.trim()) continue;
    const p = JSON.parse(line);
    const image = p.local_primary_image
      ? "/media/" + p.local_primary_image.split("/").pop()
      : null;
    const gallery = [image].filter(Boolean);
    const archived =
      (p.category_urls || []).some((u) => /arhiv|archive|arxiv/.test(u)) ||
      (p.offers?.length &&
        p.offers.every((o) =>
          /НЕТ В ПРОДАЖЕ|СНЯТ.*ПРОИЗВОДСТВ/iu.test(o.name),
        ));
    insertProduct.run(
      p.id,
      p.name,
      p.description_text || "",
      p.specifications_text || "",
      JSON.stringify(p.specification_tables || []),
      image,
      JSON.stringify(gallery),
      JSON.stringify(p.documents || []),
      p.source_url,
      archived ? 1 : 0,
    );
    for (const o of p.offers || []) {
      const price = /^\s*[\d\s]+[.,]?\d*\s*руб/.test(o.source_price_text || "")
        ? Math.round(
            Number(
              o.source_price_text
                .replace(/руб.*$/, "")
                .replaceAll(/\s/g, "")
                .replace(",", "."),
            ) * 100,
          )
        : null;
      insertOffer.run(
        o.source_offer_id,
        p.id,
        o.sku || "",
        o.name,
        Number.isSafeInteger(price) && price > 0 ? price : null,
        o.source_price_text || "По запросу",
      );
      offers++;
    }
    for (const url of p.category_urls || []) {
      const id = categoryId(url);
      if (db.prepare("SELECT id FROM categories WHERE id=?").get(id))
        insertRelation.run(p.id, id);
    }
    db.prepare("INSERT INTO search VALUES(?,?,?)").run(
      p.id,
      p.name,
      (p.offers || []).map((o) => o.sku + " " + o.name).join(" "),
    );
    n++;
  }
  db.exec("COMMIT;");
} catch (e) {
  db.exec("ROLLBACK;");
  throw e;
}
console.log(
  `Imported ${n} cards, ${offers} offers, ${position} categories; original source prices are unverified snapshots.`,
);
