import { db } from "@/lib/db.mjs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const row = db
    .prepare("SELECT id FROM products WHERE source=?")
    .get("https://anado.ru/products/item/" + slug);
  if (!row) return new Response("Товар не найден", { status: 404 });
  return new Response(null,{status:308,headers:{Location:'/product/'+row.id}});
}
