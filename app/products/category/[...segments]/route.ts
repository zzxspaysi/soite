import { db } from "@/lib/db.mjs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const id = (await params).segments.join("__");
  if (!db.prepare("SELECT id FROM categories WHERE id=?").get(id))
    return new Response("Раздел не найден", { status: 404 });
  return new Response(null,{status:308,headers:{Location:'/catalog?category='+encodeURIComponent(id)}});
}
