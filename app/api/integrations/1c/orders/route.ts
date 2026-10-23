import { integrationAuthorized, InputError } from "@/lib/commerce.mjs";
import { db } from "@/lib/db.mjs";
import { readJson, apiError } from "@/lib/http.mjs";
function auth(r: Request) {
  if (!integrationAuthorized(r.headers.get("authorization")))
    throw new InputError("Unauthorized", 401);
}
export async function GET(request: Request) {
  try {
    auth(request);
    const orders = db
      .prepare(
        "SELECT * FROM orders WHERE mode='live' AND exported_at IS NULL ORDER BY created_at LIMIT 100",
      )
      .all()
      .map((o) => ({
        id: o.id,
        createdAt: o.created_at,
        customer: JSON.parse(String(o.customer_json)),
        items: JSON.parse(String(o.items_json)),
        totalKopecks: o.total,
        paymentMethod: o.payment_method,
        status: o.status,
      }));
    return Response.json(
      { orders },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    auth(request);
    const body = await readJson(request);
    if (
      typeof body.orderId !== "string" ||
      typeof body.documentId !== "string" ||
      !body.documentId.trim()
    )
      throw new InputError("orderId and documentId required");
    const o = db
      .prepare("SELECT id FROM orders WHERE id=? AND mode='live'")
      .get(body.orderId);
    if (!o) throw new InputError("Order not found", 404);
    db.prepare("UPDATE orders SET exported_at=? WHERE id=?").run(
      new Date().toISOString(),
      body.orderId,
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
