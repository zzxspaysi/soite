export function safeExternalUrl(value) {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    /[\u0000-\u001f\u007f\\]/u.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function safePaymentUrl(value) {
  const safe = safeExternalUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  return url.protocol === "https:" &&
    !url.port &&
    ["yookassa.ru", "yoomoney.ru"].some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host),
    )
    ? url.href
    : null;
}
export function safeCatalogImage(value) {
  return typeof value === "string" &&
    /^\/(?:media\/[a-f0-9]{24}\.(?:jpe?g|png|webp|gif|bmp)|products\/[a-z0-9-]+\.(?:jpe?g|png|webp))$/i.test(
      value,
    )
    ? value
    : null;
}
