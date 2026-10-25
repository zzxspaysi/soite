import { db } from "../lib/db.mjs";
const email = process.argv[2]?.trim().toLowerCase();
if (!email)
  throw Error(
    "Укажите email уже зарегистрированного владельца: node scripts/promote-admin.mjs email",
  );
const result = db
  .prepare("UPDATE users SET role='admin' WHERE email=?")
  .run(email);
if (result.changes !== 1) throw Error("Пользователь не найден");
console.log("Права администратора выданы существующему пользователю.");
