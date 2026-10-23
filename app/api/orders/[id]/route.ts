import {
  authorizedOrder,
  publicOrder,
  InputError,
  yookassa,
  applyVerifiedPayment,
} from "@/lib/commerce.mjs";
import { apiError } from "@/lib/http.mjs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      token = new URL(request.url).searchParams.get("token");
    let o = authorizedOrder(id, token);
    if (!o) throw new InputError("Заказ не найден.", 404);
    if (o.mode === "live" && o.status === "pending" && o.provider_id) {
      try {
        applyVerifiedPayment(
          await yookassa(
            "payments/" + encodeURIComponent(String(o.provider_id)),
          ),
        );
        o = authorizedOrder(id, token);
      } catch {}
    }
    return Response.json(publicOrder(o), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
