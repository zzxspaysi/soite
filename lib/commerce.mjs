import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { db } from "./db.mjs";
export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const taxCodes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const paymentSubjects = [
  "commodity",
  "excise",
  "job",
  "service",
  "payment",
  "another",
  "intellectual_activity",
  "license",
  "property_right",
  "agent_commission",
];
export function integrationAuthorized(header) {
  const expected = process.env.ONE_C_TOKEN;
  if (!expected || expected.length < 24 || !header?.startsWith("Bearer "))
    return false;
  const supplied = header.slice(7);
  const a = Buffer.from(supplied),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
const text = (value, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export function paymentMode() {
  return process.env.PAYMENT_MODE === "live" ? "live" : "demo";
}
export function validateCustomer(data) {
  const customer = {
    name: text(data?.name, 100),
    phone: text(data?.phone, 30),
    email: text(data?.email, 150),
    delivery: data?.delivery === "courier" ? "courier" : "pickup",
    address: text(data?.address, 500),
    company: text(data?.company, 200),
    consent: data?.consent === true,
  };
  if (
    customer.name.length < 2 ||
    customer.phone.replace(/\D/g, "").length < 10 ||
    !/^\S+@\S+\.\S+$/.test(customer.email) ||
    !customer.consent
  )
    throw new InputError(
      "Заполните имя, телефон, email и согласие на обработку данных.",
    );
  if (customer.delivery === "courier" && customer.address.length < 8)
    throw new InputError("Укажите адрес доставки.");
  return customer;
}
export function quote(items, { live = false } = {}) {
  if (!Array.isArray(items) || !items.length || items.length > 100)
    throw new InputError("Добавьте товары в корзину.");
  const merged = new Map();
  for (const item of items) {
    if (
      !item ||
      typeof item.offerId !== "string" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    )
      throw new InputError("Некорректное количество товара.");
    merged.set(item.offerId, (merged.get(item.offerId) || 0) + item.quantity);
  }
  const rows = [];
  let total = 0,
    needsQuote = false;
  for (const [id, quantity] of merged) {
    if (quantity > 99)
      throw new InputError("Не более 99 единиц одного товара.");
    const o = db
      .prepare(
        "SELECT o.*,p.name product_name,p.image,p.archived FROM offers o JOIN products p ON p.id=o.product_id WHERE o.id=?",
      )
      .get(id);
    if (!o || o.archived)
      throw new InputError(
        "Один из товаров недоступен для заказа. Обновите корзину.",
      );
    if (
      live &&
      (!o.verified_at ||
        Date.now() - Date.parse(o.verified_at) > 24 * 3600_000 ||
        o.stock == null ||
        o.stock < quantity)
    )
      throw new InputError(
        "Цена и наличие требуют подтверждения. Выберите оплату по счёту — менеджер уточнит заказ.",
        409,
      );
    if (
      live &&
      (!taxCodes.includes(o.vat_code) ||
        !paymentSubjects.includes(o.payment_subject))
    )
      throw new InputError(
        "Для товара требуется уточнение условий оплаты. Выберите оплату по счёту.",
        409,
      );
    if (o.price == null) needsQuote = true;
    else total += o.price * quantity;
    rows.push({
      offerId: id,
      productId: o.product_id,
      name: o.product_name,
      variant: o.name,
      sku: o.sku,
      price: o.price,
      quantity,
      image: o.image,
      vatCode: o.vat_code,
      paymentSubject: o.payment_subject,
    });
  }
  if (!Number.isSafeInteger(total) || total > 100_000_000)
    throw new InputError("Для крупного заказа свяжитесь с менеджером.");
  return { items: rows, total, needsQuote };
}
export function createOrder(input) {
  if (!input || typeof input !== "object")
    throw new InputError("Некорректный заказ.");
  const customer = validateCustomer(input.customer);
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotency || ""))
    throw new InputError("Обновите страницу оформления заказа.");
  const method = ["bank_card", "sbp", "invoice"].includes(input.paymentMethod)
    ? input.paymentMethod
    : "invoice";
  const mode = paymentMode();
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        customer,
        items: input.items,
        method,
        expectedTotal: input.expectedTotal,
      }),
    )
    .digest("hex");
  const previous = db
    .prepare("SELECT * FROM orders WHERE idempotency=?")
    .get(input.idempotency);
  if (previous) {
    if (previous.request_hash !== requestHash)
      throw new InputError(
        "Состав заказа изменился. Повторите оформление.",
        409,
      );
    return previous;
  }
  const cart = quote(input.items, {
    live: mode === "live" && method !== "invoice",
  });
  if (input.expectedTotal !== undefined && input.expectedTotal !== cart.total)
    throw new InputError(
      "Цена заказа изменилась. Обновите страницу, чтобы проверить новую сумму.",
      409,
    );
  const id =
    "AN-" +
    new Date().toISOString().slice(0, 10).replaceAll("-", "") +
    "-" +
    randomBytes(6).toString("hex").toUpperCase();
  const status =
    cart.needsQuote || method === "invoice"
      ? "awaiting_confirmation"
      : "pending";
  db.prepare(
    "INSERT INTO orders(id,token,created_at,customer_json,items_json,total,payment_method,mode,status,idempotency,request_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    randomBytes(24).toString("hex"),
    new Date().toISOString(),
    JSON.stringify(customer),
    JSON.stringify(cart.items),
    cart.total,
    method,
    mode,
    status,
    input.idempotency,
    requestHash,
  );
  return db.prepare("SELECT * FROM orders WHERE id=?").get(id);
}
export function authorizedOrder(id, token) {
  return typeof token === "string"
    ? db.prepare("SELECT * FROM orders WHERE id=? AND token=?").get(id, token)
    : null;
}
export function publicOrder(o) {
  const { name, email, delivery } = JSON.parse(o.customer_json);
  return {
    id: o.id,
    createdAt: o.created_at,
    customer: { name, email, delivery },
    items: JSON.parse(o.items_json),
    total: o.total,
    paymentMethod: o.payment_method,
    mode: o.mode,
    status: o.status,
    paymentUrl: o.provider_url,
  };
}
function authorization() {
  if (process.env.YOOKASSA_AUTHORIZATION)
    return process.env.YOOKASSA_AUTHORIZATION;
  if (process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY)
    return (
      "Basic " +
      Buffer.from(
        process.env.YOOKASSA_SHOP_ID + ":" + process.env.YOOKASSA_SECRET_KEY,
      ).toString("base64")
    );
  throw new InputError(
    "Онлайн-оплата временно недоступна. Заказ сохранён, свяжитесь с менеджером.",
    503,
  );
}
export async function yookassa(path, { method = "GET", body, key } = {}) {
  const response = await fetch("https://api.yookassa.ru/v3/" + path, {
    method,
    headers: {
      Authorization: authorization(),
      "Content-Type": "application/json",
      ...(key ? { "Idempotence-Key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new InputError(
      "Платёжный сервис временно недоступен. Попробуйте позже.",
      502,
    );
  return response.json();
}
export async function startPayment(order) {
  if (order.status !== "pending" || order.mode !== "live") return order;
  if (order.provider_url) return order;
  const site = process.env.SITE_URL;
  if (!site?.startsWith("https://"))
    throw new InputError(
      "Онлайн-оплата ещё настраивается. Выберите оплату по счёту.",
      503,
    );
  const customer = JSON.parse(order.customer_json);
  const payment = await yookassa("payments", {
    method: "POST",
    key: order.id,
    body: {
      amount: { value: (order.total / 100).toFixed(2), currency: "RUB" },
      capture: true,
      payment_method_data: { type: order.payment_method },
      confirmation: {
        type: "redirect",
        return_url: `${site.replace(/\/$/, "")}/order/${order.id}?token=${order.token}`,
      },
      description: `Заказ ${order.id}`,
      metadata: { order_id: order.id },
      receipt: {
        customer: { email: customer.email },
        items: JSON.parse(order.items_json).map((i) => ({
          description: i.variant.slice(0, 128),
          quantity: String(i.quantity),
          amount: { value: (i.price / 100).toFixed(2), currency: "RUB" },
          vat_code: i.vatCode,
          payment_mode: "full_payment",
          payment_subject: i.paymentSubject,
        })),
      },
    },
  });
  if (!payment.id || !payment.confirmation?.confirmation_url)
    throw new InputError("Не удалось открыть оплату. Заказ сохранён.", 502);
  const url = new URL(payment.confirmation.confirmation_url);
  if (url.protocol !== "https:")
    throw new InputError("Некорректный адрес платёжного сервиса.", 502);
  db.prepare(
    "UPDATE orders SET provider_id=?,provider_url=? WHERE id=? AND provider_id IS NULL",
  ).run(payment.id, url.href, order.id);
  return db.prepare("SELECT * FROM orders WHERE id=?").get(order.id);
}
export function applyVerifiedPayment(payment) {
  const o = db
    .prepare("SELECT * FROM orders WHERE provider_id=?")
    .get(payment.id);
  if (
    !o ||
    o.mode !== "live" ||
    payment.test !== false ||
    payment.metadata?.order_id !== o.id ||
    payment.amount?.currency !== "RUB" ||
    payment.amount?.value !== (o.total / 100).toFixed(2)
  )
    throw new InputError("Payment mismatch", 400);
  if (payment.status === "succeeded" && payment.paid === true)
    db.prepare(
      "UPDATE orders SET status='paid' WHERE id=? AND status IN ('pending','canceled')",
    ).run(o.id);
  else if (payment.status === "canceled")
    db.prepare(
      "UPDATE orders SET status='canceled' WHERE id=? AND status='pending'",
    ).run(o.id);
  return o.id;
}
export function syncInventory(input) {
  if (
    !input ||
    typeof input.batchId !== "string" ||
    input.batchId.length > 100 ||
    !Array.isArray(input.offers) ||
    input.offers.length > 15000
  )
    throw new InputError("Invalid batch");
  for (const o of input.offers) {
    if (
      typeof o.id !== "string" ||
      !Number.isSafeInteger(o.priceKopecks) ||
      o.priceKopecks < 1 ||
      o.priceKopecks > 100_000_000 ||
      !Number.isInteger(o.stock) ||
      o.stock < 0 ||
      (o.vatCode != null && !taxCodes.includes(o.vatCode)) ||
      (o.paymentSubject != null &&
        !paymentSubjects.includes(o.paymentSubject)) ||
      !db.prepare("SELECT id FROM offers WHERE id=?").get(o.id)
    )
      throw new InputError("Invalid or unmapped offer");
  }
  if (db.prepare("SELECT id FROM sync_batches WHERE id=?").get(input.batchId))
    return { duplicate: true, updated: 0 };
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const o of input.offers)
      db.prepare(
        "UPDATE offers SET price=?,stock=?,verified_at=?,vat_code=?,payment_subject=? WHERE id=?",
      ).run(
        o.priceKopecks,
        o.stock,
        new Date().toISOString(),
        o.vatCode ?? null,
        o.paymentSubject ?? null,
        o.id,
      );
    db.prepare("INSERT INTO sync_batches VALUES(?,?)").run(
      input.batchId,
      new Date().toISOString(),
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { updated: input.offers.length };
}
