import { InputError } from "./commerce.mjs";
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  let host = "";
  try {
    host = new URL(origin).host;
  } catch {}
  if (!host || host !== request.headers.get("host"))
    throw new InputError("Обновите страницу и повторите действие.", 403);
}
export async function readJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Пустой запрос.");
  let size = 0;
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 512000) {
      await reader.cancel();
      throw new InputError("Слишком большой запрос.", 413);
    }
    chunks.push(value);
  }
  const data = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(data);
  } catch {
    throw new InputError("Некорректный запрос.");
  }
}
export function apiError(e) {
  return Response.json(
    {
      error:
        e instanceof InputError
          ? e.message
          : "Не удалось выполнить запрос. Попробуйте позже.",
    },
    { status: e instanceof InputError ? e.status : 500 },
  );
}
const attempts = new Map();
export function limit(request) {
  const now = Date.now(),
    ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  if (attempts.size > 10000)
    for (const [key, value] of attempts)
      if (now - value.start > 60000) attempts.delete(key);
  const entry = attempts.get(ip);
  if (entry && now - entry.start < 60000) {
    if (entry.count++ > 20)
      throw new InputError(
        "Слишком много запросов. Попробуйте через минуту.",
        429,
      );
  } else attempts.set(ip, { start: now, count: 1 });
}
