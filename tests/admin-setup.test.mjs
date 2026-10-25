import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
const directory = mkdtempSync(join(tmpdir(), "anado-admin-setup-"));
process.env.ANADO_DB = join(directory, "test.sqlite");
const { db } = await import("../lib/db.mjs");
const {
  adminSetupState,
  completeAdminSetup,
  adminSetupProblem,
  isAdminSetupOwner,
} = await import("../lib/admin-setup.mjs");
const { newSession, sessionUser } = await import("../lib/accounts.mjs");
const owner = { id: "owner", email: "owner@example.invalid" };
const stranger = { id: "stranger", email: "stranger@example.invalid" };
const token = "a".repeat(64);
beforeEach(() => {
  db.exec(
    "DELETE FROM admin_bootstrap; DELETE FROM sessions; DELETE FROM users;",
  );
  for (const user of [owner, stranger])
    db.prepare(
      "INSERT INTO users VALUES(?,?,?,'unused-test-hash','customer',?)",
    ).run(user.id, user.email, "Тест", new Date().toISOString());
  process.env.ADMIN_SETUP_EMAIL = owner.email;
  process.env.ADMIN_SETUP_TOKEN = token;
});
test("first-admin setup is closed unless a strong token and valid owner email are configured", () => {
  for (const value of [
    undefined,
    "",
    "short",
    "x".repeat(257),
    "x".repeat(32) + " ",
  ]) {
    if (value === undefined) delete process.env.ADMIN_SETUP_TOKEN;
    else process.env.ADMIN_SETUP_TOKEN = value;
    assert.equal(adminSetupState(), "disabled");
    assert.throws(
      () => completeAdminSetup(owner, token),
      (e) => e.status === 409,
    );
  }
  process.env.ADMIN_SETUP_TOKEN = token;
  process.env.ADMIN_SETUP_EMAIL = "invalid";
  assert.equal(adminSetupState(), "disabled");
});
test("configuration diagnostics distinguish missing or invalid fields without revealing secrets", () => {
  assert.equal(adminSetupProblem(), null);
  assert.equal(isAdminSetupOwner(owner), true);
  assert.equal(isAdminSetupOwner(stranger), false);
  process.env.ADMIN_SETUP_TOKEN = "x".repeat(31);
  assert.match(adminSetupProblem(), /32/);
  assert.ok(!adminSetupProblem().includes(process.env.ADMIN_SETUP_TOKEN));
  process.env.ADMIN_SETUP_TOKEN = token + "\n";
  assert.match(adminSetupProblem(), /пробел или перенос/);
  delete process.env.ADMIN_SETUP_TOKEN;
  assert.match(adminSetupProblem(), /не задана переменная ADMIN_SETUP_TOKEN/);
  assert.equal(isAdminSetupOwner(owner), false);
});
test("registration order, missing/wrong token and wrong account never grant admin", () => {
  assert.equal(adminSetupState(), "ready");
  for (const [user, key] of [
    [stranger, token],
    [owner, undefined],
    [owner, "b".repeat(64)],
    [owner, token.slice(1)],
  ])
    assert.throws(
      () => completeAdminSetup(user, key),
      (e) => e.status === 403,
    );
  assert.equal(
    db.prepare("SELECT count(*) n FROM users WHERE role='admin'").get().n,
    0,
  );
  assert.equal(db.prepare("SELECT count(*) n FROM admin_bootstrap").get().n, 0);
  assert.throws(() =>
    completeAdminSetup({ ...stranger, email: owner.email }, token),
  );
  assert.equal(
    db.prepare("SELECT role FROM users WHERE id=?").get(stranger.id).role,
    "customer",
  );
});
test("an existing administrator closes setup even with a valid key", () => {
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(stranger.id);
  assert.equal(adminSetupState(), "complete");
  assert.throws(
    () => completeAdminSetup(owner, token),
    (e) => e.status === 409,
  );
});
test("claim is atomic, revokes previous sessions and stays consumed after a token change or role reset", () => {
  const previous = newSession(owner.id),
    unaffected = newSession(stranger.id);
  completeAdminSetup(owner, token);
  assert.equal(adminSetupState(), "complete");
  assert.equal(
    db.prepare("SELECT role FROM users WHERE id=?").get(owner.id).role,
    "admin",
  );
  assert.equal(sessionUser(previous), null);
  assert.equal(sessionUser(unaffected).id, stranger.id);
  assert.notEqual(
    db.prepare("SELECT token_hash FROM admin_bootstrap").get().token_hash,
    token,
  );
  assert.throws(
    () => completeAdminSetup(owner, token),
    (e) => e.status === 409,
  );
  db.exec("UPDATE users SET role='customer'");
  process.env.ADMIN_SETUP_TOKEN = "b".repeat(64);
  assert.equal(adminSetupState(), "complete");
  assert.throws(
    () => completeAdminSetup(owner, process.env.ADMIN_SETUP_TOKEN),
    (e) => e.status === 409,
  );
});
test("concurrent server workers grant the first admin once", async () => {
  const moduleUrl = new URL("../lib/admin-setup.mjs", import.meta.url).href;
  const results = await Promise.all(
    Array.from(
      { length: 4 },
      () =>
        new Promise((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--input-type=module",
              "-e",
              `import {completeAdminSetup} from ${JSON.stringify(moduleUrl)}; try {completeAdminSetup(${JSON.stringify(owner)},process.env.ADMIN_SETUP_TOKEN); process.stdout.write('ok');} catch(e) { if(e.status===409)process.stdout.write('closed');else throw e; }`,
            ],
            { env: process.env },
          );
          let output = "",
            error = "";
          child.stdout.on("data", (d) => (output += d));
          child.stderr.on("data", (d) => (error += d));
          child.on("error", reject);
          child.on("exit", (code) =>
            code === 0 ? resolve(output) : reject(Error(error)),
          );
        }),
    ),
  );
  assert.equal(results.filter((x) => x === "ok").length, 1);
  assert.equal(results.filter((x) => x === "closed").length, 3);
  assert.equal(db.prepare("SELECT count(*) n FROM admin_bootstrap").get().n, 1);
});
after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
