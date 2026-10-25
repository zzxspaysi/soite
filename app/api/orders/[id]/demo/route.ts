import { currentUser } from "@/lib/session";
import { ownedOrder } from "@/lib/accounts.mjs";
import { authorizedOrder, InputError, publicOrder } from "@/lib/commerce.mjs";
import { db } from "@/lib/db.mjs";
import {
  apiJson,
  apiError,
  sameOrigin,
  limit,
  orderToken,
} from "@/lib/http.mjs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    limit(request, "demo-payment");
    const token = orderToken(request),
      { id } = await params;
    const user = await currentUser();
    let o = ownedOrder(id, user) || authorizedOrder(id, token);
    if (o?.user_id && o.user_id !== user?.id) o = null;
    if (!o) throw new InputError("Заказ не найден.", 404);
    if (
      o.mode !== "demo" ||
      !["pending", "demo_paid"].includes(String(o.status))
    )
      throw new InputError("Демонстрационная оплата недоступна.", 409);
    db.prepare(
      "UPDATE orders SET status='demo_paid' WHERE id=? AND mode='demo' AND status='pending'",
    ).run(id);
    return apiJson(
      publicOrder(db.prepare("SELECT * FROM orders WHERE id=?").get(id)),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
