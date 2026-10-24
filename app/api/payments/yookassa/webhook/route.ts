import { handlePaymentNotification } from "@/lib/commerce.mjs";
import { readJson, apiJson, apiError, limit } from "@/lib/http.mjs";
export async function POST(request: Request) {
  try {
    limit(request, "webhook");
    return apiJson(
      await handlePaymentNotification(
        await readJson(request, { maxBytes: 16000 }),
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
