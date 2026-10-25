import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
const directory = mkdtempSync(join(tmpdir(), "anado-cash-sections-"));
process.env.ANADO_DB = join(directory, "catalog.sqlite");
writeFileSync(
  process.env.ANADO_DB,
  gunzipSync(
    readFileSync(new URL("../data/catalog-demo.sqlite.gz", import.meta.url)),
  ),
);
const { db } = await import("../lib/db.mjs");
const { categories, listProducts, getProduct } =
  await import("../lib/catalog.mjs");
const {
  CASH_REGISTER_SECTIONS,
  storefrontCategoryId,
  LEGACY_INTERNET_SECTION,
} = await import("../lib/cash-register-sections.mjs");
const names = [
  "Онлайн кассы",
  "Смарт-терминалы",
  "Касса самообслуживания (КСО)",
  "Автономная касса (ньюджеры)",
  "Фискальные накопители",
  "Оператор фискальных данных",
  "Лицензия ККТ",
  "Доп. устройства и аксессуары",
  "Архив",
];
const originalIds = (category) =>
  db
    .prepare(
      "SELECT product_id FROM product_categories WHERE category_id=? ORDER BY product_id",
    )
    .all(category)
    .map((p) => p.product_id);
function listingIds(category) {
  const result = listProducts({ category, archive: true });
  return Array.from(
    { length: result.pages },
    (_, i) => listProducts({ category, archive: true, page: i + 1 }).products,
  )
    .flat()
    .map((p) => p.id)
    .sort();
}
test("nine requested cash register sections appear in order in every navigation tree", () => {
  const tree = categories();
  assert.deepEqual(
    tree.filter((c) => c.parent === "online-kassy").map((c) => c.name),
    names,
  );
  assert.equal(tree.filter((c) => !c.parent).length, 19);
  assert.ok(!tree.some((c) => c.id === LEGACY_INTERNET_SECTION));
  for (const section of tree.filter((c) => c.parent === "online-kassy")) {
    assert.equal(
      section.count,
      listProducts({ category: section.id, archive: true }).count,
    );
    assert.ok(section.count > 0);
  }
});
test("existing catalog and unchanged category contents are preserved", () => {
  assert.deepEqual(listingIds("online-kassy"), originalIds("online-kassy"));
  assert.equal(listingIds("online-kassy").length, 188);
  for (const id of [
    "kso",
    "fiskal-nak",
    "ofd",
    "licenzii-kkt",
    "category_111",
    "arhivkkm",
  ])
    assert.deepEqual(
      listingIds("online-kassy__" + id),
      originalIds("online-kassy__" + id),
    );
  const onlineUnion = [
    ...new Set([
      ...originalIds("online-kassy__onkassy"),
      ...originalIds(LEGACY_INTERNET_SECTION),
    ]),
  ].sort();
  assert.deepEqual(listingIds("online-kassy__onkassy"), onlineUnion);
  assert.equal(db.prepare("SELECT count(*) n FROM products").get().n, 5756);
  assert.equal(db.prepare("SELECT count(*) n FROM offers").get().n, 11972);
});
test("new groups reuse existing matching models and keep their original offers and descriptions", () => {
  const root = new Set(originalIds("online-kassy"));
  for (const id of ["smart-terminals", "autonomous"]) {
    const section = CASH_REGISTER_SECTIONS.find(
      (c) => c.id === "online-kassy__" + id,
    );
    assert.deepEqual(listingIds(section.id), [...section.products].sort());
    for (const productId of section.products) {
      assert.ok(root.has(productId));
      const p = getProduct(productId),
        original = db
          .prepare("SELECT * FROM products WHERE id=?")
          .get(productId);
      assert.equal(p.description, original.description);
      assert.equal(p.image, original.image);
      assert.deepEqual(
        p.offers.map((o) => o.id).sort(),
        db
          .prepare("SELECT id FROM offers WHERE product_id=? ORDER BY id")
          .all(productId)
          .map((o) => o.id),
      );
      assert.ok(p.categories.some((c) => c.id === section.id));
    }
  }
  assert.ok(
    listProducts({
      category: "online-kassy__smart-terminals",
      q: "Эвотор",
      archive: true,
    }).products.every((p) => p.name.includes("Эвотор")),
  );
});
test("legacy internet category resolves to online cash registers including its original product", () => {
  assert.equal(
    storefrontCategoryId(LEGACY_INTERNET_SECTION),
    "online-kassy__onkassy",
  );
  assert.deepEqual(
    listingIds(LEGACY_INTERNET_SECTION),
    listingIds("online-kassy__onkassy"),
  );
  assert.ok(listingIds("online-kassy__onkassy").includes("05054787436fc1fb"));
  assert.equal(
    getProduct("05054787436fc1fb").categories.at(-1).name,
    "Онлайн кассы",
  );
  assert.equal(
    getProduct("dd7e785b61a777d2").categories.at(-1).name,
    "Оператор фискальных данных",
  );
});
after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
