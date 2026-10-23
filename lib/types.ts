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
export const formatMoney = (v: number | null) =>
  v === null
    ? "Цена по запросу"
    : new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: v % 100 ? 2 : 0,
      }).format(v / 100);
