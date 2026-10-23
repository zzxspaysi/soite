import { quote } from "@/lib/commerce.mjs";
import { readJson, apiError, sameOrigin } from "@/lib/http.mjs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return Response.json(quote((await readJson(request)).items));
  } catch (e) {
    return apiError(e);
  }
}
