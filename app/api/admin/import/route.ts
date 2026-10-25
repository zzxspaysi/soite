import { requireUser } from "@/lib/session";
import { syncInventory } from "@/lib/commerce.mjs";
import { readJson, sameOrigin, apiJson, apiError, limit } from "@/lib/http.mjs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await requireUser(true);
    limit(request, "integration");
    return apiJson(
      syncInventory(await readJson(request, { maxBytes: 512000 })),
    );
  } catch (e) {
    return apiError(e);
  }
}
