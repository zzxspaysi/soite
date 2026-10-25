import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const live = process.env.PAYMENT_MODE === "live";
  return {
    rules: {
      userAgent: "*",
      ...(live
        ? {
            allow: "/",
            disallow: [
              "/cart",
              "/checkout",
              "/order/",
              "/api/",
              "/account",
              "/admin",
              "/login",
              "/register",
            ],
          }
        : { disallow: "/" }),
    },
    ...(live && process.env.SITE_URL
      ? { sitemap: process.env.SITE_URL + "/sitemap.xml" }
      : {}),
  };
}
