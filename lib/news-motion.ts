const key = "anado-news-motion";

export function readNewsMotion() {
  try {
    return localStorage.getItem(key) === "on";
  } catch {
    return false;
  }
}

export function saveNewsMotion(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(key, "on");
    else localStorage.removeItem(key);
  } catch {}
}
