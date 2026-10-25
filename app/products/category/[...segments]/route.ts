import { categories } from "@/lib/catalog.mjs";
import { storefrontCategoryId } from "@/lib/cash-register-sections.mjs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const id = storefrontCategoryId((await params).segments.join("__"));
  if (!categories().some((category: { id: string }) => category.id === id))
    return new Response("Раздел не найден", { status: 404 });
  return new Response(null, {
    status: 308,
    headers: { Location: "/catalog?category=" + encodeURIComponent(id) },
  });
}
