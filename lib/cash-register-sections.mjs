// Storefront navigation over the existing catalog. Original source categories,
// product records, offers and synced inventory remain intact in SQLite.
export const CASH_REGISTER_ROOT = "online-kassy";
export const LEGACY_INTERNET_SECTION = "online-kassy__kass-kompl-internet-torg";
export const CASH_REGISTER_SECTIONS = [
  {
    id: "online-kassy__onkassy",
    name: "Онлайн кассы",
    sources: ["online-kassy__onkassy", LEGACY_INTERNET_SECTION],
  },
  {
    id: "online-kassy__smart-terminals",
    name: "Смарт-терминалы",
    products: [
      "d41f2a6fb6131e76", // Viki Mini Ф
      "3f7ea01068c11dba", // aQsi 5Ф
      "84194158fd49f80d",
      "7d63b7edf149d997",
      "ea48d314e2c7cea8", // АТОЛ Sigma
      "c9a762b8463831dd",
      "90c291b7d98f7700", // АТОЛ СТБ 5 и 6
      "fdb6f7927d2cc4cc", // МКАССА RS9000-Ф
      "991eeb42e8375f7f", // Меркурий-105Ф, сенсорная касса
      "dc6dd1ddfb1677da",
      "70404221dd654e6e", // ШТРИХ СМАРТПОС и КАРТ
      "3ba99ecdacce1c7f",
      "ca3eee7b05c0f611",
      "c11342e9a6dfe860",
      "9fd456133525e745",
      "42c8b4b996647795", // Эвотор
    ],
  },
  { id: "online-kassy__kso", name: "Касса самообслуживания (КСО)" },
  {
    id: "online-kassy__autonomous",
    name: "Автономная касса (ньюджеры)",
    products: [
      "7d6e37edb1dc0466",
      "9a0fc94835e5e942", // АТОЛ 91Ф и 91Ф Lite
      "e74c02ff46f94d7f",
      "dabb388e88487e49",
      "c3a17dac8101ce9e",
      "4404fc48011c5836", // Меркурий 115/130/180/185
      "12039198360ea164", // ПИОНЕР-114Ф
    ],
  },
  { id: "online-kassy__fiskal-nak", name: "Фискальные накопители" },
  { id: "online-kassy__ofd", name: "Оператор фискальных данных" },
  { id: "online-kassy__licenzii-kkt", name: "Лицензия ККТ" },
  { id: "online-kassy__category_111", name: "Доп. устройства и аксессуары" },
  { id: "online-kassy__arhivkkm", name: "Архив" },
];

export function storefrontCategoryId(id) {
  return id === LEGACY_INTERNET_SECTION ? "online-kassy__onkassy" : id;
}

export function categoryProductQuery(id) {
  const section = CASH_REGISTER_SECTIONS.find(
    (section) => section.id === storefrontCategoryId(id),
  );
  const sources = section?.sources || [section?.id || id];
  let sql = `SELECT DISTINCT product_id FROM product_categories WHERE category_id IN (${sources.map(() => "?").join(",")})`;
  const args = [...sources];
  if (section?.products?.length) {
    sql += ` UNION SELECT id FROM products WHERE id IN (${section.products.map(() => "?").join(",")})`;
    args.push(...section.products);
  }
  return { sql, args };
}

function sectionRow(section, index, rows, rootPosition) {
  const original = rows.find((row) => row.id === section.id);
  return {
    ...original,
    id: section.id,
    name: section.name,
    parent: CASH_REGISTER_ROOT,
    position: rootPosition + (index + 1) / 100,
    source:
      original?.source ||
      "/products/category/" + section.id.replaceAll("__", "/") + "/",
  };
}

export function cashRegisterCategories(db, rows) {
  const root = rows.find((row) => row.id === CASH_REGISTER_ROOT);
  if (!root) return rows;
  const sections = CASH_REGISTER_SECTIONS.map((section, index) => {
    const query = categoryProductQuery(section.id);
    const count = db
      .prepare(`SELECT count(*) count FROM (${query.sql})`)
      .get(...query.args).count;
    return { ...sectionRow(section, index, rows, root.position), count };
  });
  return rows.flatMap((row) =>
    row.id === CASH_REGISTER_ROOT
      ? [row, ...sections]
      : row.parent === CASH_REGISTER_ROOT
        ? []
        : [row],
  );
}

export function cashRegisterProductCategories(productId, rows) {
  const root = rows.find((row) => row.id === CASH_REGISTER_ROOT);
  const ids = new Set(rows.map((row) => row.id));
  const sections = CASH_REGISTER_SECTIONS.flatMap((section, index) => {
    const matches =
      (section.sources || [section.id]).some((id) => ids.has(id)) ||
      section.products?.includes(productId);
    return matches
      ? [sectionRow(section, index, rows, root?.position || 0)]
      : [];
  });
  return [
    ...rows.filter((row) => row.parent !== CASH_REGISTER_ROOT),
    ...sections,
  ].sort((a, b) => a.position - b.position);
}
