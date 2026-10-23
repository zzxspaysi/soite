import { yookassa, applyVerifiedPayment, InputError } from "@/lib/commerce.mjs";
import { readJson, apiError } from "@/lib/http.mjs";
export async function POST(request: Request) {
  try {
    const event = await readJson(request);
    if (
      event.type !== "notification" ||
      ![
        "payment.succeeded",
        "payment.canceled",
        "payment.waiting_for_capture",
      ].includes(event.event) ||
      typeof event.object?.id !== "string" ||
      !/^[a-zA-Z0-9-]{10,100}$/.test(event.object.id)
    )
      throw new InputError("Invalid notification");
    const payment = await yookassa("payments/" + event.object.id);
    applyVerifiedPayment(payment);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
