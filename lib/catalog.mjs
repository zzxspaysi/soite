import { db } from "./db.mjs";
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
    .all(...args, (page - 1) * 24);
  return { products, count, page, pages };
}
export function getProduct(id) {
  const p = db.prepare(summary + " WHERE p.id=?").get(id);
  if (!p) return null;
  return {
    ...p,
    tables: JSON.parse(p.tables_json),
    images:
      id === "9fd456133525e745"
        ? ["/products/evotor-73.jpg", ...JSON.parse(p.images_json)]
        : JSON.parse(p.images_json),
    documents: JSON.parse(p.documents_json),
    offers: db
      .prepare("SELECT * FROM offers WHERE product_id=?")
      .all(id)
      .map((o) => ({ ...o })),
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
  const stmt = db.prepare(
    `SELECT p.image FROM products p JOIN product_categories pc ON pc.product_id=p.id WHERE pc.category_id=? AND p.image IS NOT NULL AND p.archived=0 ORDER BY length(p.name) LIMIT 1`,
  );
  const visuals = Object.fromEntries(
    categories()
      .filter((c) => !c.parent)
      .map((c) => [c.id, stmt.get(c.id)?.image || null]),
  );
  return {
    ...visuals,
    "online-kassy": "/media/fedb9fb9a3e33c56c17d967f.jpg",
    category_369: "/media/7921cf829a8e34f2cdb978f6.jpg",
    printland: "/media/6085e410e837c4e8b882f625.png",
    ident: "/media/5f1d7439afdaa6a66a4a5174.jpg",
  };
}
