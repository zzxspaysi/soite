import { safeCatalogImage } from "./urls.mjs";
export type Category = {
  id: string;
  name: string;
  parent: string | null;
  position: number;
  source: string;
  count: number;
};
export type Offer = {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  price: number | null;
  source_price: string;
  stock: number | null;
  verified_at: string | null;
};
export type Product = {
  id: string;
  name: string;
  image: string | null;
  price: number | null;
  offer_count: number;
  archived: number;
  description?: string;
  specs?: string;
  tables?: { text: string; colspan: number; rowspan: number }[][][];
  images?: string[];
  documents?: { name: string; source_url: string }[];
  source?: string;
  offers?: Offer[];
  categories?: Category[];
};
export type CartItem = {
  offerId: string;
  productId: string;
  name: string;
  variant: string;
  image: string | null;
  price: number | null;
  quantity: number;
};
export function restoreCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const items = new Map<string, CartItem>();
  for (const row of value.slice(0, 100)) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.offerId !== "string" ||
      !/^\d{1,20}$/.test(row.offerId) ||
      typeof row.productId !== "string" ||
      !/^[a-f0-9]{16}$/.test(row.productId) ||
      typeof row.name !== "string" ||
      typeof row.variant !== "string" ||
      !Number.isInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > 99 ||
      (row.price !== null &&
        (!Number.isSafeInteger(row.price) || row.price < 1))
    )
      continue;
    items.set(row.offerId, {
      offerId: row.offerId,
      productId: row.productId,
      name: row.name.slice(0, 400),
      variant: row.variant.slice(0, 1000),
      image: safeCatalogImage(row.image),
      price: row.price,
      quantity: Math.min(
        99,
        row.quantity + (items.get(row.offerId)?.quantity || 0),
      ),
    });
  }
  return [...items.values()];
}
export const formatMoney = (v: number | null) =>
  v === null
    ? "Цена по запросу"
    : new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: v % 100 ? 2 : 0,
      }).format(v / 100);
