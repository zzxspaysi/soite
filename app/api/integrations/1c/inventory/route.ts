import {
  integrationAuthorized,
  syncInventory,
  InputError,
} from "@/lib/commerce.mjs";
import { db } from "@/lib/db.mjs";
import { readJson, apiError } from "@/lib/http.mjs";
function auth(r: Request) {
  if (!integrationAuthorized(r.headers.get("authorization")))
    throw new InputError("Unauthorized", 401);
}
export async function POST(request: Request) {
  try {
    auth(request);
    return Response.json(syncInventory(await readJson(request)));
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(request: Request) {
  try {
    auth(request);
    const p = new URL(request.url).searchParams,
      offset = Math.max(0, Math.floor(Number(p.get("offset")) || 0));
    return Response.json(
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
