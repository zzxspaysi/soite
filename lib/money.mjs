// Prices stay in integer kopecks throughout checkout and payment APIs.
// Round each unit before multiplying so displayed rows and order totals agree.
export const roundPrice = (kopecks) =>
  kopecks == null ? null : Math.round(kopecks / 100) * 100;

const rubles = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
export const formatMoney = (kopecks) =>
  kopecks == null
    ? "Цена по запросу"
    : rubles.format(roundPrice(kopecks) / 100);
