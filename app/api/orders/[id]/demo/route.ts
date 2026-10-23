import { authorizedOrder, InputError, publicOrder } from "@/lib/commerce.mjs";
import { db } from "@/lib/db.mjs";
import { readJson, apiError, sameOrigin } from "@/lib/http.mjs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const { token } = await readJson(request),
      { id } = await params;
    const o = authorizedOrder(id, token);
    if (!o) throw new InputError("Заказ не найден.", 404);
    if (
      o.mode !== "demo" ||
      !["pending", "demo_paid"].includes(String(o.status))
    )
      throw new InputError("Демонстрационная оплата недоступна.", 409);
    db.prepare(
      "UPDATE orders SET status='demo_paid' WHERE id=? AND mode='demo' AND status='pending'",
    ).run(id);
    return Response.json(publicOrder(authorizedOrder(id, token)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
