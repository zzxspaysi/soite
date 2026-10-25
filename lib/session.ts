import { cookies } from "next/headers";
import { sessionUser } from "./accounts.mjs";
import { InputError } from "./commerce.mjs";
export async function currentUser() {
  return sessionUser((await cookies()).get("anado_session")?.value);
}
export async function requireUser(admin = false) {
  const user = await currentUser();
  if (!user) throw new InputError("Войдите в личный кабинет.", 401);
  if (admin && user.role !== "admin") throw new InputError("Нет доступа.", 403);
  return user;
}
