import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "./db.mjs";
import { InputError } from "./commerce.mjs";

const digest = (value) => createHash("sha256").update(value).digest();
function configuration() {
  const token = process.env.ADMIN_SETUP_TOKEN;
  const email = process.env.ADMIN_SETUP_EMAIL?.trim().toLowerCase();
  return typeof token === "string" &&
    token.length >= 32 &&
    token.length <= 256 &&
    !/\s/.test(token) &&
    typeof email === "string" &&
    email.length <= 150 &&
    /^\S+@\S+\.\S+$/.test(email)
    ? { token, email }
    : null;
}
function alreadyConfigured() {
  return Boolean(
    db.prepare("SELECT id FROM admin_bootstrap WHERE id=1").get() ||
    db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get(),
  );
}
export function adminSetupState() {
  if (alreadyConfigured()) return "complete";
  return configuration() ? "ready" : "disabled";
}
export function checkAdminSetupKey(user, token) {
  const config = configuration();
  if (alreadyConfigured() || !config)
    throw new InputError("Первоначальная настройка недоступна.", 409);
  if (
    !user ||
    user.email !== config.email ||
    typeof token !== "string" ||
    token.length > 256 ||
    !timingSafeEqual(digest(token), digest(config.token))
  )
    throw new InputError("Проверьте аккаунт и ключ настройки.", 403);
}
export function completeAdminSetup(user, token) {
  // The singleton record and admin check are protected by one SQLite write lock.
  db.exec("BEGIN IMMEDIATE");
  try {
    checkAdminSetupKey(user, token);
    const changed = db
      .prepare(
        "UPDATE users SET role='admin' WHERE id=? AND email=? AND role='customer'",
      )
      .run(user.id, user.email);
    if (changed.changes !== 1) throw new InputError("Аккаунт недоступен.", 409);
    db.prepare("INSERT INTO admin_bootstrap VALUES(1,?,?,?)").run(
      user.id,
      digest(token).toString("hex"),
      new Date().toISOString(),
    );
    // Revoke every old session when changing privileges; the route issues a fresh one.
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
