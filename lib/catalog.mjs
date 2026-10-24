import { roundPrice } from "./money.mjs";
import { db } from "./db.mjs";
import { safeExternalUrl } from "./urls.mjs";
export function categories() {
  return db
    .prepare(
      "SELECT c.*, (SELECT count(*) FROM product_categories pc WHERE pc.category_id=c.id) count FROM categories c ORDER BY position",
    )
    .all()
    .map((c) => ({ ...c }));
}
const summary = `SELECT p.*, (SELECT min(price) FROM offers WHERE product_id=p.id) price, (SELECT count(*) FROM offers WHERE product_id=p.id) offer_count FROM products p`;
export function listProducts({
  category = "",
  q = "",
  sort = "",
  page = 1,
  priced = false,
  archive = false,
} = {}) {
  q = String(q).slice(0, 200);
  const where = [],
    args = [];
  if (category) {
    where.push(
      "p.id IN (SELECT product_id FROM product_categories WHERE category_id=?)",
    );
    args.push(category);
  }
  if (q.trim()) {
    const tokens = q.match(/[\p{L}\p{N}]+/gu)?.slice(0, 10) || [];
    if (tokens.length) {
      where.push(
        "p.id IN (SELECT product_id FROM search WHERE search MATCH ?)",
      );
      args.push(tokens.map((t) => '"' + t + '"*').join(" AND "));
    } else where.push("0");
  }
  if (priced)
    where.push(
      "EXISTS(SELECT 1 FROM offers WHERE product_id=p.id AND price IS NOT NULL)",
    );
  if (!archive && !category && !q) where.push("p.archived=0");
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  const count = db
    .prepare("SELECT count(*) count FROM products p" + clause)
    .get(...args).count;
  const pages = Math.max(1, Math.ceil(count / 24));
  page = Math.min(pages, Math.max(1, Math.floor(Number(page)) || 1));
  const order =
    sort === "price-asc"
      ? "price IS NULL,price ASC"
      : sort === "price-desc"
        ? "price IS NULL,price DESC"
        : "p.archived ASC,p.image IS NULL,p.name COLLATE NOCASE";
  const products = db
    .prepare(summary + clause + " ORDER BY " + order + " LIMIT 24 OFFSET ?")
    .all(...args, (page - 1) * 24)
    .map((product) => ({ ...product, price: roundPrice(product.price) }));
  return { products, count, page, pages };
}
export function getProduct(id) {
  const p = db.prepare(summary + " WHERE p.id=?").get(id);
  if (!p) return null;
  return {
    ...p,
    price: roundPrice(p.price),
    tables: JSON.parse(p.tables_json),
    images:
      id === "9fd456133525e745"
        ? ["/products/evotor-73.jpg", ...JSON.parse(p.images_json)]
        : JSON.parse(p.images_json),
    documents: JSON.parse(p.documents_json).flatMap((document) => {
      const url = safeExternalUrl(document.source_url);
      return url
        ? [{ name: String(document.name || "Документ"), source_url: url }]
        : [];
    }),
    offers: db
      .prepare("SELECT * FROM offers WHERE product_id=?")
      .all(id)
      .map((o) => ({ ...o, price: roundPrice(o.price) })),
    categories: db
      .prepare(
        "SELECT c.* FROM categories c JOIN product_categories pc ON c.id=pc.category_id WHERE pc.product_id=? ORDER BY c.position",
      )
      .all(id)
      .map((c) => ({ ...c })),
  };
}
export function featured() {
  return [
    "9fd456133525e745",
    "ee4274ae23a0e67a",
    "87b167eef0169767",
    "7d6e37edb1dc0466",
  ]
    .map(getProduct)
    .filter(Boolean);
}
export function categoryVisuals() {
  // Real ANADO products chosen to illustrate their own catalog sections.
  const covers = {
    "online-kassy": "9fd456133525e745", // Эвотор 7.3
    category_369: "012d0d365b78ccba", // АТОЛ SMART.Droid, sale section
    printland: "d82a94e474e86ac1", // TSC TE200
    ident: "87b167eef0169767", // Mindeo MS3690 Mark
    pos_sistems: "798776d8dcef43ec", // АТОЛ Ритейл Pro
    pos_oborud: "f1a08662780758f4", // АТОЛ Т200
    pos_perifer: "4ebdefa360f09d4f", // АТОЛ CD-330
    vesovoe_oborud: "0261bda6937ab3c6", // Масса-К МК-32.2-RA11
    bank_oborud: "12bf68dff242d4dc", // DORS 800 Series
    equaring: "2e633989208111f6", // VeriFone Vx520
    markirov: "ac53cdc3e08a6bb9", // Towa AP65-60
    rashodniki: "79b2ac87a3814b91", // Rolls of polypropylene labels
    protivkrajy: "581c82c75b9c60ff", // Sensormatic Ultra Exit 2.0
    category_104: "091f4a4cc9020f45", // Склад 15
    category_103: "1ce1683cc9b6dabe", // CAS CNW-460
    battery: "5a624ea87535fc92", // GS 12-3.2
    "other-devices": "c22fa27498d68c62", // Citizen CX-32N
  };
  const stmt = db.prepare(
    `SELECT p.image FROM products p JOIN product_categories pc ON pc.product_id=p.id
     WHERE pc.category_id=? AND p.image IS NOT NULL AND p.archived=0
     ORDER BY CASE WHEN p.id=? THEN 0 ELSE 1 END, length(p.name), p.id LIMIT 1`,
  );
  return Object.fromEntries(
    categories()
      .filter((c) => !c.parent && c.id !== "uslugi" && c.id !== "zip")
      .map((c) => [c.id, stmt.get(c.id, covers[c.id] || "")?.image || null]),
  );
}
