import {
  randomBytes,
  scrypt as rawScrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db.mjs";
import { InputError } from "./commerce.mjs";
const scrypt = promisify(rawScrypt);
const digest = (s) => createHash("sha256").update(s).digest("hex");
export async function registerAccount(input) {
  const email = String(input.email || "")
      .trim()
      .toLowerCase(),
    name = String(input.name || "").trim();
  const password = input.password;
  if (
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 150 ||
    name.length < 2 ||
    name.length > 100 ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128 ||
    input.consent !== true
  )
    throw new InputError(
      "Укажите имя, email, пароль от 12 до 128 символов и согласие.",
    );
  const salt = randomBytes(16).toString("hex"),
    hash = Buffer.from(await scrypt(password, salt, 64)).toString("hex");
  try {
    const id = randomBytes(16).toString("hex");
    db.prepare(
      "INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)",
    ).run(id, email, name, salt + ":" + hash, new Date().toISOString());
    return id;
  } catch (e) {
    if (
      e.errcode === 2067 ||
      e.errcode === 1555 ||
      e.code?.includes("CONSTRAINT")
    )
      throw new InputError(
        "Не удалось зарегистрироваться с этим email. Попробуйте войти.",
        409,
      );
    throw e;
  }
}
export async function loginAccount(input) {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (typeof input.password !== "string" || input.password.length > 128)
    throw new InputError("Неверный email или пароль.", 401);
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  const [salt, hash] = (
    user?.password_hash || "00000000000000000000000000000000:" + "0".repeat(128)
  ).split(":");
  const candidate = Buffer.from(await scrypt(input.password, salt, 64));
  if (!timingSafeEqual(candidate, Buffer.from(hash, "hex")) || !user)
    throw new InputError("Неверный email или пароль.", 401);
  return user.id;
}
export function newSession(userId) {
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    digest(token),
    userId,
    Date.now() + 7 * 86400000,
  );
  return token;
}
export function sessionUser(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  return (
    db
      .prepare(
        "SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
      )
      .get(digest(token), Date.now()) || null
  );
}
export function revokeSession(token) {
  if (typeof token === "string")
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(token));
}
export function ownedOrder(id, user) {
  return user
    ? db
        .prepare("SELECT * FROM orders WHERE id=? AND user_id=?")
        .get(id, user.id)
    : null;
}
