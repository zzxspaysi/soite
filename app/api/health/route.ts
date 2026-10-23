import { db } from "@/lib/db.mjs";
export function GET() {
  const count = db.prepare("SELECT count(*) n FROM products").get()?.n;
  return Response.json(
    { ok: count === 5756, catalogCards: count },
    { status: count === 5756 ? 200 : 503 },
  );
}
