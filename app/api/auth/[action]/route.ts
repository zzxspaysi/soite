import { cookies } from "next/headers";
import {
  registerAccount,
  loginAccount,
  newSession,
  revokeSession,
} from "@/lib/accounts.mjs";
import { readJson, apiJson, apiError, sameOrigin, limit } from "@/lib/http.mjs";
import { InputError } from "@/lib/commerce.mjs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(request);
    limit(request, "auth");
    const { action } = await params;
    const jar = await cookies();
    if (action === "logout") {
      revokeSession(jar.get("anado_session")?.value);
      jar.delete("anado_session");
      return apiJson({ ok: true });
    }
    if (!["login", "register"].includes(action))
      throw new InputError("Не найдено", 404);
    const data = await readJson(request, { maxBytes: 4096 });
    const id =
      action === "register"
        ? await registerAccount(data)
        : await loginAccount(data);
    revokeSession(jar.get("anado_session")?.value);
    jar.set("anado_session", newSession(id), {
      httpOnly: true,
      sameSite: "lax",
      secure:
        request.headers.get("x-forwarded-proto") === "https" ||
        new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 7 * 86400,
    });
    return apiJson({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
