import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "anado-accounts-"));
process.env.ANADO_DB = join(directory, "test.sqlite");
process.env.PAYMENT_MODE = "live";
const { db } = await import("../lib/db.mjs");
const {
  registerAccount,
  loginAccount,
  newSession,
  sessionUser,
  revokeSession,
  ownedOrder,
} = await import("../lib/accounts.mjs");
const { createOrder, syncInventory } = await import("../lib/commerce.mjs");
const { receiveInvoice } = await import("../lib/invoices.mjs");
const credentials = {
  name: "Тестовый покупатель",
  email: "owner@example.invalid",
  password: "Test-only-password-123!",
  consent: true,
};
let owner, other, order;
test("registration hashes passwords, rejects duplicate emails and wrong credentials", async () => {
  owner = await registerAccount(credentials);
  other = await registerAccount({
    ...credentials,
    email: "other@example.invalid",
  });
  assert.equal(
    await loginAccount({ ...credentials, email: " OWNER@example.invalid " }),
    owner,
  );
  const row = db.prepare("SELECT * FROM users WHERE id=?").get(owner);
  assert.equal(row.role, "customer");
  assert.ok(!row.password_hash.includes(credentials.password));
  await assert.rejects(
    () => registerAccount(credentials),
    (e) => e.status === 409,
  );
  await assert.rejects(
    () => loginAccount({ ...credentials, password: "wrong" }),
    (e) => e.status === 401,
  );
  await assert.rejects(
    () => loginAccount({ ...credentials, email: "missing@example.invalid" }),
    (e) => e.status === 401,
  );
  await assert.rejects(() =>
    registerAccount({ ...credentials, password: "short" }),
  );
});
test("sessions expire, are hashed at rest and are revoked on logout", () => {
  const token = newSession(owner);
  assert.equal(sessionUser(token).id, owner);
  assert.notEqual(
    db.prepare("SELECT token_hash FROM sessions").get().token_hash,
    token,
  );
  revokeSession(token);
  assert.equal(sessionUser(token), null);
  const expired = newSession(owner);
  db.exec("UPDATE sessions SET expires_at=0");
  assert.equal(sessionUser(expired), null);
  assert.equal(sessionUser("guessed"), null);
});
test("orders are assigned by server identity and cannot be read or reused by another customer", () => {
  db.exec(
    "INSERT INTO products(id,name) VALUES('p','Касса'); INSERT INTO offers(id,product_id,name,price) VALUES('o','p','Касса без ФН',10000)",
  );
  const input = {
    customer: {
      name: "Покупатель",
      phone: "+79990000000",
      email: "owner@example.invalid",
      consent: true,
      buyerType: "business",
      company: "ООО Тест",
      inn: "5402500210",
      kpp: "540601001",
      legalAddress: "Новосибирск, ул. Тестовая, 1",
    },
    items: [{ offerId: "o", quantity: 2 }],
    paymentMethod: "invoice",
    idempotency: "test-owned-order-123",
  };
  order = createOrder(input, owner);
  assert.equal(order.total, 20000);
  assert.equal(ownedOrder(order.id, { id: owner }).id, order.id);
  assert.equal(ownedOrder(order.id, { id: other }), undefined);
  assert.equal(createOrder(input, owner).id, order.id);
  assert.throws(
    () => createOrder(input, other),
    (e) => e.status === 409,
  );
  assert.throws(() =>
    createOrder(
      {
        ...input,
        idempotency: "test-bad-buyer-123",
        customer: { ...input.customer, inn: "bad" },
      },
      owner,
    ),
  );
});
test("1C invoices verify order total and taxes, remain idempotent and protect numbering", () => {
  const invoice = {
    orderId: order.id,
    documentId: "1c-invoice-1",
    number: "26-TEST-1",
    issuedAt: "2026-10-25",
    totalKopecks: 20000,
    taxes: [{ label: "Без НДС", amountKopecks: 0 }],
  };
  assert.throws(
    () => receiveInvoice({ ...invoice, totalKopecks: 100 }),
    (e) => e.status === 409,
  );
  assert.throws(() =>
    receiveInvoice({
      ...invoice,
      taxes: [{ label: "НДС", amountKopecks: 30000 }],
    }),
  );
  assert.equal(receiveInvoice(invoice).ok, true);
  assert.equal(receiveInvoice(invoice).duplicate, true);
  assert.throws(
    () => receiveInvoice({ ...invoice, number: "26-OTHER" }),
    (e) => e.status === 409,
  );
  db.prepare("UPDATE orders SET mode='demo' WHERE id=?").run(order.id);
  assert.throws(
    () => receiveInvoice(invoice),
    (e) => e.status === 404,
  );
});
test("name/price imports update search and reject unmapped batches atomically", () => {
  syncInventory({
    batchId: "names-1",
    offers: [
      {
        id: "o",
        name: "Новая комплектация",
        productName: "Новый сканер",
        priceKopecks: 12345,
        stock: 5,
      },
    ],
  });
  assert.equal(
    db.prepare("SELECT name FROM products WHERE id='p'").get().name,
    "Новый сканер",
  );
  assert.equal(
    db
      .prepare("SELECT product_id FROM search WHERE search MATCH 'сканер'")
      .get().product_id,
    "p",
  );
  assert.throws(() =>
    syncInventory({
      batchId: "bad-names",
      offers: [
        { id: "o", name: "Не применять", priceKopecks: 100, stock: 2 },
        { id: "missing", priceKopecks: 100, stock: 1 },
      ],
    }),
  );
  assert.equal(
    db.prepare("SELECT name FROM offers WHERE id='o'").get().name,
    "Новая комплектация",
  );
});
after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
