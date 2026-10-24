import { quote } from "@/lib/commerce.mjs";
import { readJson, apiJson, apiError, sameOrigin, limit } from "@/lib/http.mjs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    limit(request, "quote");
    return apiJson(quote((await readJson(request)).items));
  } catch (e) {
    return apiError(e);
  }
}
