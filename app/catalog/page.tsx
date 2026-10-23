import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { categories, listProducts } from "@/lib/catalog.mjs";
import { ProductCard } from "@/components/product-card";
import { CategorySelect } from "@/components/category-select";
import type { Category, Product } from "@/lib/types";
export const metadata = { title: "Каталог оборудования" };
export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  );
  const tree = categories() as unknown as Category[],
    category = tree.find((c) => c.id === params.category),
    parent = category?.parent
      ? tree.find((c) => c.id === category.parent)
      : category;
  const result = listProducts({
    category: params.category,
    q: params.q,
    sort: params.sort,
    page: Number(params.page) || 1,
    priced: params.priced === "1",
    archive: true,
  });
  const children = tree.filter((c) => c.parent === category?.id);
  const url = (page: number) => {
    const p = new URLSearchParams(params);
    p.set("page", String(page));
    return "/catalog?" + p.toString();
  };
  return (
    <>
      <div className="shell page-heading">
        <div className="breadcrumbs">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/catalog">Каталог</Link>
          {category && (
            <>
              <span>/</span>
              <span>{category.name}</span>
            </>
          )}
        </div>
        <h1>
          {params.q
            ? `Поиск: ${params.q}`
            : category?.name || "Каталог оборудования"}{" "}
          <span>{result.count}</span>
        </h1>
      </div>
      <div className="shell catalog-layout">
        <aside className="catalog-sidebar">
          <div className="sidebar-title">Разделы каталога</div>
          <Link href="/catalog" className={!category ? "selected" : ""}>
            Все товары <span>5756</span>
          </Link>
          {tree
            .filter((c) => !c.parent)
            .map((c) => (
              <div key={c.id}>
                <Link
                  className={`sidebar-root ${parent?.id === c.id ? "selected" : ""}`}
                  href={`/catalog?category=${c.id}`}
                >
                  {c.name}
                  <span>{c.count}</span>
                </Link>
                {parent?.id === c.id &&
                  tree
                    .filter((x) => x.parent === c.id)
                    .map((x) => (
                      <Link
                        className={`child-link ${x.id === category?.id ? "selected" : ""}`}
                        key={x.id}
                        href={`/catalog?category=${x.id}`}
                      >
                        {x.name}
                        <span>{x.count}</span>
                      </Link>
                    ))}
              </div>
            ))}
        </aside>
        <div className="catalog-results">
          <CategorySelect categories={tree} value={params.category || ""} />
          {children.length > 0 && (
            <div className="subcategory-chips">
              {children.map((c) => (
                <Link
                  className="chip"
                  href={`/catalog?category=${c.id}`}
                  key={c.id}
                >
                  {c.name}
                  <span>{c.count}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="catalog-tools">
            <form action="/catalog">
              {params.category && (
                <input type="hidden" name="category" value={params.category} />
              )}
              <input
                type="search"
                name="q"
                defaultValue={params.q}
                placeholder="Модель или артикул"
                aria-label="Поиск по каталогу"
              />
              <select
                name="sort"
                defaultValue={params.sort || ""}
                aria-label="Сортировка"
              >
                <option value="">По названию</option>
                <option value="price-asc">Сначала дешевле</option>
                <option value="price-desc">Сначала дороже</option>
              </select>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="priced"
                  value="1"
                  defaultChecked={params.priced === "1"}
                />
                С указанной ценой
              </label>
              <button className="btn btn-blue">
                Найти <Search size={14} />
              </button>
            </form>
          </div>
          <p className="result-note">
            {result.count} товаров · страница {result.page} из {result.pages}
          </p>
          {result.products.length ? (
            <>
              <div className="product-grid">
                {(result.products as unknown as Product[]).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              <nav className="pagination" aria-label="Страницы каталога">
                {result.page > 1 && (
                  <Link
                    href={url(result.page - 1)}
                    aria-label="Предыдущая страница"
                  >
                    ←
                  </Link>
                )}
                {Array.from(
                  new Set([
                    1,
                    ...Array.from(
                      { length: 5 },
                      (_, i) => result.page - 2 + i,
                    ).filter((n) => n > 1 && n < result.pages),
                    result.pages,
                  ]),
                )
                  .sort((a, b) => a - b)
                  .map((n, i, arr) => (
                    <span className="pagination-fragment" key={n}>
                      {i > 0 && n - arr[i - 1] > 1 && <span>…</span>}
                      <Link
                        className={n === result.page ? "active" : ""}
                        href={url(n)}
                        aria-current={n === result.page ? "page" : undefined}
                      >
                        {n}
                      </Link>
                    </span>
                  ))}
                {result.page < result.pages && (
                  <Link
                    href={url(result.page + 1)}
                    aria-label="Следующая страница"
                  >
                    <ArrowRight size={14} />
                  </Link>
                )}
              </nav>
            </>
          ) : (
            <div className="empty-state">
              <Search size={40} />
              <h2>Ничего не найдено</h2>
              <p>Попробуйте другое название, артикул или раздел каталога.</p>
              <Link href="/catalog" className="btn btn-blue">
                Открыть каталог <ArrowRight size={17} />
              </Link>
            </div>
          )}
          <p className="price-disclaimer">
            Цены и комплектации перенесены с ANADO. Наличие и актуальную
            стоимость подтвердит менеджер. Архивные позиции сохранены в
            каталоге.
          </p>
        </div>
      </div>
    </>
  );
}
