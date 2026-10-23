import type { MetadataRoute } from "next";
import { db } from "@/lib/db.mjs";
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.SITE_URL;
  if (!site?.startsWith("https://") || process.env.PAYMENT_MODE !== "live")
    return [];
  return [
    ...[
      "",
      "/catalog",
      "/solutions",
      "/services",
      "/about",
      "/contacts",
      "/delivery",
    ].map((p) => ({ url: site.replace(/\/$/, "") + p })),
    ...db
      .prepare("SELECT id FROM products")
      .all()
      .map((p) => ({ url: site.replace(/\/$/, "") + "/product/" + p.id })),
  ];
}
