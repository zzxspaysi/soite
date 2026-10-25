export const businessSections = [
  {
    id: "retail",
    title: "Ритейл",
    icon: "store",
    category: "online-kassy",
    intro: "Кассы, сканеры, весы и программы для торговой точки.",
    items: [
      { id: "retail", title: "Все решения для торговли" },
      { id: "food", title: "Продукты питания" },
      { id: "fashion", title: "Одежда и обувь" },
      { id: "alcohol", title: "Вино и спиртные напитки" },
      { id: "home", title: "Мебель и товары для дома" },
    ],
  },
  {
    id: "horeca",
    title: "HoReCa",
    icon: "cafe",
    category: "pos_sistems",
    intro: "POS-системы, кассовая периферия и программы для заведений.",
    items: [
      { id: "horeca", title: "Все решения для HoReCa" },
      { id: "restaurants", title: "Кафе и рестораны" },
      { id: "foodcourt", title: "Для фудкортов" },
      { id: "bakery", title: "Кофейни и пекарни" },
      { id: "bars", title: "Бары и пивоварни" },
    ],
  },
  {
    id: "services",
    title: "Сфера услуг",
    icon: "beauty",
    category: "online-kassy",
    intro: "Оборудование для расчётов с клиентами и учёта услуг.",
    items: [
      { id: "services", title: "Решения для сферы услуг" },
      { id: "beauty", title: "Салон красоты" },
      { id: "auto", title: "Автосервис и шиномонтаж" },
      { id: "construction", title: "Строительство и ремонт" },
      { id: "dentistry", title: "Стоматология" },
    ],
  },
  {
    id: "logistics",
    title: "Логистика и склад",
    icon: "warehouse",
    category: "ident",
    intro:
      "Сканеры, терминалы сбора данных и принтеры этикеток для складского учёта.",
    items: [{ id: "logistics", title: "Решения для складов и логистики" }],
  },
  {
    id: "ecommerce",
    title: "E-commerce",
    icon: "cloud",
    category: "equaring",
    intro:
      "Подбор решений для оплаты и фискализации интернет-заказов. Доступность облачной кассы и условия подключения уточняются индивидуально.",
    items: [{ id: "ecommerce", title: "Облачная касса для онлайн-бизнеса" }],
  },
  {
    id: "catalog",
    title: "Каталог",
    icon: "terminal",
    category: "",
    intro: "Оборудование, программное обеспечение и услуги ANADO.",
    items: [
      { id: "equipment", title: "Оборудование", href: "/catalog" },
      {
        id: "software",
        title: "Кассовое ПО",
        href: "/catalog?category=category_104",
      },
      {
        id: "service-catalog",
        title: "Услуги",
        href: "/catalog?category=uslugi",
      },
    ],
  },
];
export function businessHref(item: { id: string; href?: string }) {
  if (item.href) return item.href;
  const section = businessSections.find((section) =>
    section.items.some((entry) => entry.id === item.id),
  );
  return section?.category
    ? `/catalog?category=${encodeURIComponent(section.category)}`
    : "/catalog";
}
