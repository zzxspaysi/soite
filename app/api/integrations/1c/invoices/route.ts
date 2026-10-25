import { integrationAuthorized, InputError } from "@/lib/commerce.mjs";
import { receiveInvoice } from "@/lib/invoices.mjs";
import { readJson, apiJson, apiError, limit } from "@/lib/http.mjs";
export async function POST(request: Request) {
  try {
    if (!integrationAuthorized(request.headers.get("authorization")))
      throw new InputError("Unauthorized", 401);
    limit(request, "integration");
    return apiJson(receiveInvoice(await readJson(request)));
  } catch (e) {
    return apiError(e);
  }
}
