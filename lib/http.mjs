import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { InputError } from "./commerce.mjs";

export function sameOrigin(request) {
  const value = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")
    throw new InputError("Обновите страницу и повторите действие.", 403);
  let origin;
  try {
    origin = new URL(value);
  } catch {
    throw new InputError("Обновите страницу и повторите действие.", 403);
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.origin !== value ||
    origin.host !== request.headers.get("host")
  )
    throw new InputError("Обновите страницу и повторите действие.", 403);
  const configured = process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) {
    let expected;
    try {
      expected = new URL(configured).origin;
    } catch {
      throw new InputError("Адрес магазина ещё настраивается.", 503);
    }
    if (origin.origin !== expected)
      throw new InputError("Обновите страницу и повторите действие.", 403);
  } else {
    const forwarded = request.headers.get("x-forwarded-proto");
    const protocol =
      forwarded === "https" ? "https:" : new URL(request.url).protocol;
    if (origin.protocol !== protocol)
      throw new InputError("Обновите страницу и повторите действие.", 403);
  }
}

export async function readJson(
  request,
  { maxBytes = 64000, timeoutMs = 10000 } = {},
) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new InputError("Ожидается application/json.", 415);
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new InputError("Слишком большой запрос.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Пустой запрос.");
  const buffer = Buffer.allocUnsafe(maxBytes);
  let size = 0,
    timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new InputError("Время ожидания запроса истекло.", 408));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    const read = async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes)
          throw new InputError("Слишком большой запрос.", 413);
        buffer.set(value, size - value.length);
      }
      let data;
      try {
        data = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            buffer.subarray(0, size),
          ),
        );
      } catch {
        throw new InputError("Некорректный JSON.");
      }
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new InputError("Ожидается объект JSON.");
      return data;
    };
    return await Promise.race([read(), expired]);
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function apiJson(data, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  return Response.json(data, { ...options, headers });
}
export function apiError(error) {
  return apiJson(
    {
      error:
        error instanceof InputError
          ? error.message
          : "Не удалось выполнить запрос. Попробуйте позже.",
    },
    {
      status: error instanceof InputError ? error.status : 500,
      headers:
        error?.status === 429
          ? { "Retry-After": String(error.retryAfter || 60) }
          : {},
    },
  );
}

const policies = {
  auth: { client: 10, global: 40 },
  "order-create": { client: 10, global: 60 },
  quote: { client: 120, global: 600 },
  "order-read": { client: 120, global: 600 },
  "demo-payment": { client: 30, global: 120 },
  webhook: { client: 120, global: 300 },
  integration: { client: 120, global: 600 },
  "provider-check": { client: 6, global: 60 },
};
export function createRateLimiter({ now = Date.now, maxKeys = 4096 } = {}) {
  const entries = new Map();
  let sweepAt = 0;
  return (request, policyName = "order-create", subject = "") => {
    const policy = policies[policyName];
    if (!policy) throw new Error("Unknown rate-limit policy");
    const time = now();
    if (time >= sweepAt || entries.size >= maxKeys) {
      for (const [key, value] of entries)
        if (value.reset <= time) entries.delete(key);
      sweepAt = time + 60000;
    }
    // Proxy headers are only a client hint; the global budget is mandatory.
    const candidate = request?.headers
      .get("x-forwarded-for")
      ?.split(",")
      .at(-1)
      ?.trim();
    const hint =
      subject || (candidate && isIP(candidate) ? candidate : "shared");
    const digest = createHash("sha256").update(hint).digest("hex");
    const keys = [policyName + ":global", policyName + ":" + digest];
    const quotas = [policy.global, policy.client];
    const values = keys.map((key) => {
      const value = entries.get(key);
      return value?.reset > time ? value : { count: 0, reset: time + 60000 };
    });
    for (let i = 0; i < keys.length; i++)
      if (values[i].count >= quotas[i]) {
        const error = new InputError(
          "Слишком много запросов. Попробуйте через минуту.",
          429,
        );
        error.retryAfter = Math.max(
          1,
          Math.ceil((values[i].reset - time) / 1000),
        );
        throw error;
      }
    if (entries.size + keys.filter((key) => !entries.has(key)).length > maxKeys)
      throw new InputError(
        "Слишком много запросов. Попробуйте через минуту.",
        429,
      );
    keys.forEach((key, index) =>
      entries.set(key, { ...values[index], count: values[index].count + 1 }),
    );
  };
}
export const limit = createRateLimiter();
export function orderToken(request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}
