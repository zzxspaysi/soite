import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const filename = process.env.ANADO_DB || resolve(".local/anado.sqlite");
mkdirSync(dirname(filename), { recursive: true });
export const db = new DatabaseSync(filename);
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
export const money = (cents) =>
  cents == null
    ? "Цена по запросу"
    : new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: cents % 100 ? 2 : 0,
      }).format(cents / 100);
