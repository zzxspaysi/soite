import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { DatabaseSync } from "node:sqlite";

// The demo seed contains the public catalog only, never customer orders or credentials.
const database = resolve(process.env.ANADO_DB || ".local/anado.sqlite");
if (!existsSync(database)) {
  const seed = resolve("data/catalog-demo.sqlite.gz");
  if (!existsSync(seed))
    throw new Error(
      "Demo catalog missing. Run node scripts/export-demo.mjs first.",
    );
  mkdirSync(dirname(database), { recursive: true });
  const staging = database + ".initializing";
  await pipeline(
    createReadStream(seed),
    createGunzip(),
    createWriteStream(staging),
  );
  renameSync(staging, database);
  // Establish WAL before parallel Next.js build workers open the restored catalog.
  const prepared = new DatabaseSync(database);
  prepared.exec("PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL");
  prepared.close();
  console.log("ANADO: demo catalog restored.");
}
