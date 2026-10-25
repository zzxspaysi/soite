import { integrationAuthorized, InputError } from "@/lib/commerce.mjs";
import { db } from "@/lib/db.mjs";
import { readJson, apiJson, apiError, limit } from "@/lib/http.mjs";
function auth(r: Request) {
  if (!integrationAuthorized(r.headers.get("authorization")))
    throw new InputError("Unauthorized", 401);
}
export async function GET(request: Request) {
  try {
    auth(request);
    limit(request, "integration");
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
    return apiJson({ orders }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    auth(request);
    limit(request, "integration");
    const body = await readJson(request);
    if (
      typeof body.orderId !== "string" ||
      body.orderId.length > 100 ||
      typeof body.documentId !== "string" ||
      body.documentId.length > 128 ||
      !body.documentId.trim()
    )
      throw new InputError("orderId and documentId required");
    const o = db
      .prepare(
        "SELECT id,one_c_document_id FROM orders WHERE id=? AND mode='live'",
      )
      .get(body.orderId);
    if (!o) throw new InputError("Order not found", 404);
    if (o.one_c_document_id && o.one_c_document_id !== body.documentId)
      throw new InputError("Order already linked to another document", 409);
    const saved = db
      .prepare(
        "UPDATE orders SET exported_at=coalesce(exported_at,?),one_c_document_id=? WHERE id=? AND (one_c_document_id IS NULL OR one_c_document_id=?)",
      )
      .run(
        new Date().toISOString(),
        body.documentId,
        body.orderId,
        body.documentId,
      );
    if (!saved.changes)
      throw new InputError("Order already linked to another document", 409);
    return apiJson({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
