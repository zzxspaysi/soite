import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "anado-security-"));
process.env.ANADO_DB = join(directory, "security.sqlite");
process.env.PAYMENT_MODE = "demo";
delete process.env.SITE_URL;
delete process.env.RENDER_EXTERNAL_URL;
const { db } = await import("../lib/db.mjs");
const {
  createOrder,
  authorizedOrder,
  quote,
  syncInventory,
  handlePaymentNotification,
  startPayment,
} = await import("../lib/commerce.mjs");
const { sameOrigin, readJson, apiError, createRateLimiter, orderToken } =
  await import("../lib/http.mjs");
const { safeExternalUrl, safePaymentUrl, safeCatalogImage } =
  await import("../lib/urls.mjs");
db.exec(
  "INSERT INTO products(id,name,archived) VALUES('safe','Safe terminal',0); INSERT INTO offers(id,product_id,name,sku,price,stock,verified_at,vat_code,payment_subject) VALUES('1','safe','Terminal','SKU',10000,10,datetime('now'),1,'commodity')",
);
const input = (key) => ({
  idempotency: key,
  paymentMethod: "bank_card",
  customer: {
    name: "Security test",
    email: "security@example.invalid",
    phone: "+79990000000",
    consent: true,
    delivery: "pickup",
  },
  items: [{ offerId: "1", quantity: 1 }],
});
const jsonRequest = (body) =>
  new Request("https://shop.example/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

test("JSON rejects non-objects, invalid encoding, wrong content types and oversized bodies", async () => {
  for (const body of ["null", "[]", '"text"', "{broken"])
    await assert.rejects(
      () => readJson(jsonRequest(body)),
      (error) => error.status === 400,
    );
  await assert.rejects(
    () =>
      readJson(
        new Request("https://shop.example", { method: "POST", body: "{}" }),
      ),
    (error) => error.status === 415,
  );
  await assert.rejects(
    () => readJson(jsonRequest("x".repeat(64001))),
    (error) => error.status === 413,
  );
  await assert.rejects(
    () =>
      readJson(
        new Request("https://shop.example", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125]),
        }),
      ),
    (error) => error.status === 400,
  );
  assert.deepEqual(await readJson(jsonRequest('{"ok":true}')), { ok: true });
});
test("an unfinished request body times out instead of occupying a reader indefinitely", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("{"));
    },
  });
  const request = new Request("https://shop.example", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    duplex: "half",
  });
  await assert.rejects(
    () => readJson(request, { timeoutMs: 20 }),
    (error) => error.status === 408,
  );
});
test("CSRF rejects cross-scheme, forged serialized origins and cross-site fetch metadata", () => {
  const request = (origin, extra = {}) =>
    new Request("https://shop.example/api", {
      headers: { host: "shop.example", origin, ...extra },
    });
  for (const origin of [
    "http://shop.example",
    "https://evil.example",
    "https://shop.example/path",
    "https://user@shop.example",
    "null",
  ])
    assert.throws(
      () => sameOrigin(request(origin)),
      (error) => error.status === 403,
    );
  assert.throws(
    () =>
      sameOrigin(
        request("https://shop.example", { "sec-fetch-site": "cross-site" }),
      ),
    (error) => error.status === 403,
  );
  sameOrigin(
    request("https://shop.example", { "sec-fetch-site": "same-origin" }),
  );
  process.env.RENDER_EXTERNAL_URL = "https://shop.example";
  try {
    sameOrigin(
      new Request("http://internal.example/api/orders", {
        method: "POST",
        headers: {
          host: "shop.example",
          origin: "https://shop.example",
          "x-forwarded-proto": "https",
        },
      }),
    );
    assert.throws(
      () =>
        sameOrigin(request("https://other.example", { host: "other.example" })),
      (error) => error.status === 403,
    );
  } finally {
    delete process.env.RENDER_EXTERNAL_URL;
  }
});
test("forged forwarding prefixes cannot bypass the client quota, and different IPs cannot bypass the global quota", () => {
  let time = 1000;
  const limited = createRateLimiter({ now: () => time });
  const request = (ip) =>
    new Request("https://shop.example", { headers: { "x-forwarded-for": ip } });
  for (let n = 0; n < 10; n++) limited(request(`203.0.113.${n}, 198.51.100.1`));
  assert.throws(
    () => limited(request("203.0.113.200, 198.51.100.1")),
    (error) => error.status === 429,
  );
  const global = createRateLimiter({ now: () => time });
  for (let n = 1; n <= 60; n++) global(request("203.0.113." + n));
  assert.throws(
    () => global(request("203.0.113.61")),
    (error) => error.status === 429,
  );
  time += 60001;
  global(request("203.0.113.61"));
  const bounded = createRateLimiter({ now: () => time, maxKeys: 3 });
  bounded(request("203.0.113.1"));
  bounded(request("203.0.113.2"));
  assert.throws(
    () => bounded(request("203.0.113.3")),
    (error) => error.status === 429,
  );
});
test("order access is isolated and query-string credentials are not accepted by the API", () => {
  const first = createOrder(input("security-order-first"));
  const second = createOrder(input("security-order-second"));
  assert.ok(!authorizedOrder(first.id, second.token));
  assert.ok(!authorizedOrder(first.id, "f".repeat(48)));
  assert.equal(authorizedOrder(first.id, first.token).id, first.id);
  assert.equal(
    orderToken(new Request("https://shop.example/api?token=" + first.token)),
    null,
  );
  assert.equal(
    orderToken(
      new Request("https://shop.example/api", {
        headers: { Authorization: "Bearer " + first.token },
      }),
    ),
    first.token,
  );
  if (process.platform !== "win32")
    assert.equal(statSync(process.env.ANADO_DB).mode & 0o777, 0o600);
});
test("a demo installation keeps at most 500 demo orders and never deletes live orders", () => {
  const existing = createOrder(input("existing-live-order"));
  db.prepare("UPDATE orders SET mode='live' WHERE id=?").run(existing.id);
  for (let n = 0; n < 505; n++)
    createOrder(input("bounded-demo-order-" + String(n).padStart(4, "0")));
  assert.equal(
    db.prepare("SELECT count(*) n FROM orders WHERE mode='demo'").get().n,
    500,
  );
  assert.equal(
    db.prepare("SELECT mode FROM orders WHERE id=?").get(existing.id).mode,
    "live",
  );
});
test("unknown webhook IDs never cause an authenticated provider request", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Unexpected provider request");
  };
  try {
    assert.deepEqual(
      await handlePaymentNotification({
        type: "notification",
        event: "payment.succeeded",
        object: { id: "unknown-payment-12345", paid: true },
      }),
      { ok: true, ignored: true },
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("a forged webhook success never overrides the provider pending state", async () => {
  const order = createOrder(input("verified-webhook-order"));
  db.prepare(
    "UPDATE orders SET mode='live',provider_id=?,status='pending' WHERE id=?",
  ).run("known-payment-12345", order.id);
  process.env.YOOKASSA_AUTHORIZATION = "Basic security-fixture";
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(
      url,
      "https://api.yookassa.ru/v3/payments/known-payment-12345",
    );
    assert.equal(options.redirect, "error");
    return Response.json({
      id: "known-payment-12345",
      test: false,
      amount: { value: "100.00", currency: "RUB" },
      metadata: { order_id: order.id },
      paid: false,
      status: "pending",
    });
  };
  try {
    await handlePaymentNotification({
      type: "notification",
      event: "payment.succeeded",
      object: { id: "known-payment-12345", paid: true, status: "succeeded" },
    });
    assert.equal(authorizedOrder(order.id, order.token).status, "pending");
  } finally {
    globalThis.fetch = original;
    delete process.env.YOOKASSA_AUTHORIZATION;
  }
});
test("live payment creation is explicitly disabled until the production workflow is enabled", () => {
  process.env.PAYMENT_MODE = "live";
  delete process.env.LIVE_PAYMENTS_ENABLED;
  try {
    assert.throws(
      () => createOrder(input("live-payments-disabled")),
      (error) => error.status === 503,
    );
  } finally {
    process.env.PAYMENT_MODE = "demo";
  }
});
test("URLs reject script schemes, credentials, lookalike payment hosts and remote cart images", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>",
    "https://user:pass@example.com/a",
  ])
    assert.equal(safeExternalUrl(url), null);
  for (const url of [
    "https://yookassa.ru.evil.example/pay",
    "https://evil.example/pay",
    "https://yoomoney.ru:8443/pay",
    "http://yookassa.ru/pay",
  ])
    assert.equal(safePaymentUrl(url), null);
  assert.equal(
    safePaymentUrl("https://yoomoney.ru/checkout/pay"),
    "https://yoomoney.ru/checkout/pay",
  );
  assert.equal(safeCatalogImage("https://evil.example/tracker"), null);
  assert.equal(safeCatalogImage("/media/../../.local/anado.sqlite"), null);
  assert.ok(safeCatalogImage("/media/" + "a".repeat(24) + ".jpg"));
});
test("invalid inventory rows fail cleanly, SQL metacharacters cannot change the catalog, and errors do not leak details", async () => {
  assert.throws(
    () => syncInventory({ batchId: "bad-null-row", offers: [null] }),
    (error) => error.status === 400,
  );
  assert.throws(() => quote([{ offerId: "1' OR 1=1 --", quantity: 1 }]));
  assert.equal(db.prepare("SELECT count(*) n FROM products").get().n, 1);
  const response = apiError(new Error("private-server-detail"));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.ok(!(await response.text()).includes("private-server-detail"));
});
after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
