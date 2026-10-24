import {
  integrationAuthorized,
  syncInventory,
  InputError,
} from "@/lib/commerce.mjs";
import { db } from "@/lib/db.mjs";
import { readJson, apiJson, apiError, limit } from "@/lib/http.mjs";
function auth(r: Request) {
  if (!integrationAuthorized(r.headers.get("authorization")))
    throw new InputError("Unauthorized", 401);
}
export async function POST(request: Request) {
  try {
    auth(request);
    limit(request, "integration");
    return apiJson(
      syncInventory(await readJson(request, { maxBytes: 512000 })),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(request: Request) {
  try {
    auth(request);
    limit(request, "integration");
    const p = new URL(request.url).searchParams,
      value = p.get("offset") || "0",
      offset = Number(value);
    if (!/^\d{1,8}$/.test(value) || !Number.isSafeInteger(offset))
      throw new InputError("Invalid offset");
    return apiJson(
      {
        offers: db
          .prepare(
            "SELECT id sourceOfferId,product_id productId,sku,name,price priceKopecks,stock,verified_at verifiedAt,vat_code vatCode,payment_subject paymentSubject FROM offers ORDER BY id LIMIT 500 OFFSET ?",
          )
          .all(offset),
        nextOffset: offset + 500,
        total: db.prepare("SELECT count(*) n FROM offers").get()?.n,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
