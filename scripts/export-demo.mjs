import {
  mkdtempSync,
  existsSync,
  mkdirSync,
  createReadStream,
  createWriteStream,
  renameSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

if (!existsSync("catalog/products.jsonl"))
  throw new Error(
    "The original ANADO export is required to build a clean demo seed.",
  );
const scratch = mkdtempSync(join(tmpdir(), "anado-demo-seed-"));
const database = join(scratch, "catalog.sqlite");
const result = spawnSync(process.execPath, ["scripts/prepare-catalog.mjs"], {
  stdio: "inherit",
  env: { ...process.env, ANADO_DB: database },
});
if (result.status !== 0) throw new Error("Catalog import failed");
const db = new DatabaseSync(database);
for (const table of [
  "orders",
  "sync_batches",
  "users",
  "sessions",
  "order_invoices",
]) {
  if (db.prepare(`SELECT count(*) n FROM ${table}`).get().n !== 0)
    throw new Error(
      "Demo seed must not contain accounts, sessions, invoices, orders or synchronization history",
    );
}
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
const clean = join(scratch, "clean.sqlite");
db.exec("VACUUM INTO '" + clean.replaceAll("'", "''") + "'");
db.close();
mkdirSync("data", { recursive: true });
const output = resolve("data/catalog-demo.sqlite.gz");
await pipeline(
  createReadStream(clean),
  createGzip({ level: 9 }),
  createWriteStream(output + ".tmp"),
);
renameSync(output + ".tmp", output);
console.log("Clean public catalog saved to data/catalog-demo.sqlite.gz");
