import { db } from "./db.mjs";
import { InputError } from "./commerce.mjs";
export function receiveInvoice(body) {
  const { orderId, documentId, number, issuedAt, taxes, totalKopecks } = body;
  if (
    [orderId, documentId, number].some(
      (x) => typeof x !== "string" || !x.trim() || x.length > 128,
    ) ||
    typeof issuedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(issuedAt) ||
    !Number.isFinite(Date.parse(issuedAt))
  )
    throw new InputError("Некорректные реквизиты счёта");
  const order = db
    .prepare("SELECT * FROM orders WHERE id=? AND mode='live'")
    .get(orderId);
  if (!order || order.status === "canceled")
    throw new InputError("Заказ не найден или отменён", 404);
  const items = JSON.parse(order.items_json);
  if (
    totalKopecks !== order.total ||
    items.some((x) => x.price === null) ||
    !Array.isArray(taxes) ||
    taxes.length !== items.length
  )
    throw new InputError("Сумма или позиции не совпадают с заказом", 409);
  const normalized = taxes.map((t, i) => {
    if (
      typeof t.label !== "string" ||
      !t.label.trim() ||
      t.label.length > 40 ||
      !Number.isSafeInteger(t.amountKopecks) ||
      t.amountKopecks < 0 ||
      t.amountKopecks > items[i].price * items[i].quantity
    )
      throw new InputError("Некорректный НДС позиции");
    return { label: t.label.trim(), amountKopecks: t.amountKopecks };
  });
  const data = JSON.stringify(normalized),
    old = db
      .prepare("SELECT * FROM order_invoices WHERE order_id=?")
      .get(orderId);
  if (old) {
    if (
      old.document_id === documentId &&
      old.number === number &&
      old.issued_at === issuedAt &&
      old.taxes_json === data
    )
      return { duplicate: true };
    throw new InputError("Счёт уже зарегистрирован с другими реквизитами", 409);
  }
  try {
    db.prepare("INSERT INTO order_invoices VALUES(?,?,?,?,?,?)").run(
      orderId,
      documentId,
      number,
      issuedAt,
      data,
      new Date().toISOString(),
    );
  } catch (e) {
    if (
      e.errcode === 2067 ||
      e.errcode === 1555 ||
      e.code?.includes("CONSTRAINT")
    )
      throw new InputError("Номер или документ уже использован", 409);
    throw e;
  }
  return { ok: true };
}
