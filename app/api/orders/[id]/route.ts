import {
  authorizedOrder,
  publicOrder,
  InputError,
  yookassa,
  applyVerifiedPayment,
} from "@/lib/commerce.mjs";
import { apiJson, apiError, limit, orderToken } from "@/lib/http.mjs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    limit(request, "order-read");
    const { id } = await params,
      token = orderToken(request);
    let o = authorizedOrder(id, token);
    if (!o) throw new InputError("Заказ не найден.", 404);
    if (o.mode === "live" && o.status === "pending" && o.provider_id) {
      try {
        limit(request, "provider-check", String(o.id));
        applyVerifiedPayment(
          await yookassa(
            "payments/" + encodeURIComponent(String(o.provider_id)),
          ),
        );
        o = authorizedOrder(id, token);
      } catch {}
    }
    return apiJson(publicOrder(o), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
