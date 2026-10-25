import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import { loginAccount, newSession } from "@/lib/accounts.mjs";
import { checkAdminSetupKey, completeAdminSetup } from "@/lib/admin-setup.mjs";
import { readJson, apiJson, apiError, sameOrigin, limit } from "@/lib/http.mjs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    limit(request, "admin-setup");
    const user = await requireUser();
    const data = await readJson(request, { maxBytes: 4096 });
    checkAdminSetupKey(user, data.token);
    // A session alone is insufficient for the first privilege elevation.
    const id = await loginAccount({
      email: user.email,
      password: data.password,
    });
    completeAdminSetup(user, data.token);
    (await cookies()).set("anado_session", newSession(id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400,
      secure:
        request.headers.get("x-forwarded-proto") === "https" ||
        new URL(request.url).protocol === "https:",
    });
    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
