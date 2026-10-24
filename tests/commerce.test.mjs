import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
const directory = mkdtempSync(join(tmpdir(), "anado-test-"));
process.env.ANADO_DB = join(directory, "test.sqlite");
process.env.PAYMENT_MODE = "demo";
const { db } = await import("../lib/db.mjs");
const {
  quote,
  createOrder,
  authorizedOrder,
  syncInventory,
  integrationAuthorized,
  startPayment,
  applyVerifiedPayment,
} = await import("../lib/commerce.mjs");
const { sameOrigin, readJson } = await import("../lib/http.mjs");
db.prepare("INSERT INTO products(id,name,archived) VALUES(?,?,?)").run(
  "p1",
  "Тестовая касса",
  0,
);
db.prepare("INSERT INTO products(id,name,archived) VALUES(?,?,?)").run(
  "old",
  "Архивная касса",
  1,
);
db.exec(
  "INSERT INTO offers(id,product_id,sku,name,price) VALUES('1','p1','SKU1','Касса без ФН',10000),('2','p1','SKU2','Комплект по запросу',NULL),('3','old','OLD','Снято с производства',100)",
);
const customer = {
  name: "Тестовый покупатель",
  phone: "+79990000000",
  email: "test@example.invalid",
  delivery: "pickup",
  consent: true,
};
const orderInput = (key = "test-idempotency-0001") => ({
  customer,
  items: [{ offerId: "1", quantity: 2, price: 1 }],
  paymentMethod: "bank_card",
  idempotency: key,
  total: 1,
});
test("server ignores submitted total and price, merges quantities, rejects invalid and archived offers", () => {
  assert.equal(quote(orderInput().items).total, 20000);
  assert.equal(
    quote([
      { offerId: "1", quantity: 1 },
      { offerId: "1", quantity: 2 },
    ]).items[0].quantity,
    3,
  );
  for (const items of [
    [{ offerId: "missing", quantity: 1 }],
    [{ offerId: "3", quantity: 1 }],
    [{ offerId: "1", quantity: -1 }],
    [{ offerId: "1", quantity: 1.5 }],
    [{ offerId: "1", quantity: 100 }],
  ])
    assert.throws(() => quote(items));
});
test("quote-only positions stay null and produce a confirmation request without online payment", () => {
  assert.equal(quote([{ offerId: "2", quantity: 1 }]).needsQuote, true);
  const order = createOrder({
    ...orderInput("quote-idempotency-0001"),
    items: [{ offerId: "2", quantity: 1 }],
  });
  assert.equal(order.status, "awaiting_confirmation");
  assert.equal(JSON.parse(order.items_json)[0].price, null);
});
test("order creation is idempotent; changed body conflicts; access requires unguessable token", () => {
  const o = createOrder(orderInput()),
    retry = createOrder(orderInput());
  assert.equal(o.id, retry.id);
  assert.equal(o.total, 20000);
  assert.equal(o.mode, "demo");
  assert.throws(() =>
    createOrder({ ...orderInput(), items: [{ offerId: "1", quantity: 3 }] }),
  );
  assert.ok(!authorizedOrder(o.id, "wrong"));
  assert.equal(authorizedOrder(o.id, o.token).id, o.id);
  assert.throws(() =>
    createOrder({
      ...orderInput("invalid-customer-0001"),
      customer: { ...customer, consent: false },
    }),
  );
  assert.throws(() =>
    createOrder({ ...orderInput("changed-price-0001"), expectedTotal: 1 }),
  );
});
test("live payment requires fresh verified prices and sufficient inventory", () => {
  assert.throws(() => quote([{ offerId: "1", quantity: 1 }], { live: true }));
  syncInventory({
    batchId: "first",
    offers: [
      {
        id: "1",
        priceKopecks: 12345,
        stock: 3,
        vatCode: 1,
        paymentSubject: "commodity",
      },
    ],
  });
  assert.equal(
    quote([{ offerId: "1", quantity: 2 }], { live: true }).total,
    24600,
  );
  assert.throws(() => quote([{ offerId: "1", quantity: 4 }], { live: true }));
  db.prepare("UPDATE offers SET verified_at=? WHERE id=?").run(
    "2020-01-01T00:00:00Z",
    "1",
  );
  assert.throws(() => quote([{ offerId: "1", quantity: 1 }], { live: true }));
});
test("inventory batches are idempotent and validated before any writes; 1C requires a strong token", () => {
  assert.equal(
    syncInventory({
      batchId: "first",
      offers: [{ id: "1", priceKopecks: 500, stock: 3 }],
    }).duplicate,
    true,
  );
  assert.equal(
    db.prepare("SELECT price FROM offers WHERE id=?").get("1").price,
    12345,
  );
  assert.throws(() =>
    syncInventory({
      batchId: "bad",
      offers: [
        { id: "1", priceKopecks: 500, stock: 3 },
        { id: "unknown", priceKopecks: 100, stock: 1 },
      ],
    }),
  );
  assert.equal(
    db.prepare("SELECT price FROM offers WHERE id=?").get("1").price,
    12345,
  );
  assert.equal(integrationAuthorized("Bearer guessed"), false);
  process.env.ONE_C_TOKEN = "x".repeat(32);
  assert.equal(integrationAuthorized("Bearer " + "x".repeat(32)), true);
  assert.equal(integrationAuthorized("Bearer " + "я".repeat(32)), false);
});
test("YooKassa requests use server totals and a stable idempotency key; only verified matching live payments mark paid", async () => {
  process.env.LIVE_PAYMENTS_ENABLED = "1";
  process.env.PAYMENT_MODE = "live";
  process.env.SITE_URL = "https://store.example.invalid";
  process.env.YOOKASSA_AUTHORIZATION = "Basic test-fixture";
  syncInventory({
    batchId: "second",
    offers: [
      {
        id: "1",
        priceKopecks: 12345,
        stock: 3,
        vatCode: 1,
        paymentSubject: "commodity",
      },
    ],
  });
  const o = createOrder(orderInput("live-idempotency-0001"));
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.yookassa.ru/v3/payments");
    assert.equal(options.headers["Idempotence-Key"], o.id);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.amount, { value: "246.00", currency: "RUB" });
    assert.equal(body.payment_method_data.type, "bank_card");
    assert.equal(body.receipt.items[0].quantity, "2");
    assert.deepEqual(body.receipt.items[0].amount, {
      value: "123.00",
      currency: "RUB",
    });
    return Response.json({
      id: "payment-live-12345",
      confirmation: { confirmation_url: "https://yookassa.ru/checkout/test" },
    });
  };
  try {
    const paidOrder = await startPayment(o);
    await startPayment(paidOrder);
    assert.equal(calls, 1);
    const payment = {
      id: "payment-live-12345",
      test: false,
      metadata: { order_id: o.id },
      amount: { value: "246.00", currency: "RUB" },
      status: "succeeded",
      paid: true,
    };
    for (const invalid of [
      { ...payment, test: true },
      { ...payment, amount: { value: "0.01", currency: "RUB" } },
      { ...payment, metadata: { order_id: "other" } },
      { ...payment, amount: { value: "246.00", currency: "USD" } },
    ])
      assert.throws(() => applyVerifiedPayment(invalid));
    assert.equal(authorizedOrder(o.id, o.token).status, "pending");
    applyVerifiedPayment({ ...payment, paid: false });
    assert.equal(authorizedOrder(o.id, o.token).status, "pending");
    applyVerifiedPayment(payment);
    applyVerifiedPayment(payment);
    assert.equal(authorizedOrder(o.id, o.token).status, "paid");
    applyVerifiedPayment({ ...payment, status: "canceled" });
    assert.equal(authorizedOrder(o.id, o.token).status, "paid");
  } finally {
    globalThis.fetch = originalFetch;
    process.env.PAYMENT_MODE = "demo";
    delete process.env.LIVE_PAYMENTS_ENABLED;
    delete process.env.SITE_URL;
  }
});
test("browser writes reject cross-origin requests and JSON bodies are bounded", async () => {
  assert.throws(() =>
    sameOrigin(
      new Request("https://shop.example/api/orders", {
        headers: { origin: "https://evil.example", host: "shop.example" },
      }),
    ),
  );
  sameOrigin(
    new Request("https://shop.example/api/orders", {
      headers: { origin: "https://shop.example", host: "shop.example" },
    }),
  );
  await assert.rejects(() =>
    readJson(
      new Request("https://shop.example", {
        method: "POST",
        body: "x".repeat(512001),
      }),
    ),
  );
});
test("parallel server workers initialize SQLite without a locked database", async () => {
  const database = join(directory, "parallel.sqlite");
  const moduleUrl = new URL("../lib/db.mjs", import.meta.url).href;
  await Promise.all(
    Array.from(
      { length: 6 },
      () =>
        new Promise((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--input-type=module",
              "-e",
              `import {db} from ${JSON.stringify(moduleUrl)}; db.prepare('SELECT count(*) FROM orders').get(); db.close();`,
            ],
            { env: { ...process.env, ANADO_DB: database } },
          );
          let stderr = "";
          child.stderr.on("data", (data) => (stderr += data));
          child.on("error", reject);
          child.on("exit", (code) =>
            code === 0
              ? resolve()
              : reject(new Error(stderr || `Worker exited ${code}`)),
          );
        }),
    ),
  );
});
after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
