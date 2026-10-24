import { createOrder, startPayment, publicOrder } from "@/lib/commerce.mjs";
import { readJson, apiJson, apiError, sameOrigin, limit } from "@/lib/http.mjs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    limit(request);
    const order = await startPayment(createOrder(await readJson(request)));
    return apiJson(
      {
        order: publicOrder(order),
        url: `/order/${order.id}#token=${order.token}`,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
