import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";

const filename = process.env.ANADO_DB || resolve(".local/anado.sqlite");
mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
export const db = new DatabaseSync(filename);
chmodSync(filename, 0o600);
db.exec("PRAGMA busy_timeout=10000");
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,parent TEXT,position INTEGER,source TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT,specs TEXT,tables_json TEXT,image TEXT,images_json TEXT,documents_json TEXT,source TEXT,archived INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY,product_id TEXT REFERENCES products(id),sku TEXT,name TEXT,price INTEGER,source_price TEXT,stock INTEGER,verified_at TEXT,vat_code INTEGER,payment_subject TEXT);
CREATE INDEX IF NOT EXISTS offers_product ON offers(product_id);
CREATE TABLE IF NOT EXISTS product_categories(product_id TEXT REFERENCES products(id),category_id TEXT REFERENCES categories(id),PRIMARY KEY(product_id,category_id));
CREATE INDEX IF NOT EXISTS category_products ON product_categories(category_id);
CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(product_id UNINDEXED,name,sku,tokenize='unicode61');
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,token TEXT UNIQUE,created_at TEXT,customer_json TEXT,items_json TEXT,total INTEGER,payment_method TEXT,mode TEXT,status TEXT,provider_id TEXT UNIQUE,provider_url TEXT,idempotency TEXT UNIQUE,request_hash TEXT,exported_at TEXT);
CREATE TABLE IF NOT EXISTS sync_batches(id TEXT PRIMARY KEY,created_at TEXT);
`);
const offerColumns = db
  .prepare("PRAGMA table_info(offers)")
  .all()
  .map((c) => c.name);
if (!offerColumns.includes("vat_code"))
  db.exec("ALTER TABLE offers ADD COLUMN vat_code INTEGER");
if (!offerColumns.includes("payment_subject"))
  db.exec("ALTER TABLE offers ADD COLUMN payment_subject TEXT");
export const categoryId = (url) =>
  new URL(url).pathname
    .replace("/products/category/", "")
    .replace(/\/$/, "")
    .replaceAll("/", "__");
export { formatMoney as money } from "./money.mjs";

db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS order_invoices(order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,document_id TEXT UNIQUE NOT NULL,number TEXT UNIQUE NOT NULL,issued_at TEXT NOT NULL,taxes_json TEXT NOT NULL,received_at TEXT NOT NULL);`);
db.exec("BEGIN IMMEDIATE");
try {
  if (
    !db
      .prepare("PRAGMA table_info(orders)")
      .all()
      .some((c) => c.name === "user_id")
  )
    db.exec("ALTER TABLE orders ADD COLUMN user_id TEXT REFERENCES users(id)");
  db.exec(
    "CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id,created_at)",
  );

  if (
    !db
      .prepare("PRAGMA table_info(orders)")
      .all()
      .some((c) => c.name === "one_c_document_id")
  )
    db.exec("ALTER TABLE orders ADD COLUMN one_c_document_id TEXT");
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
