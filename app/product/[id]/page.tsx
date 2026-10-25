import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { getProduct } from "@/lib/catalog.mjs";
import { ProductBuy } from "@/components/product-buy";
import type { Product } from "@/lib/types";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = getProduct((await params).id) as unknown as Product | null;
  return { title: p?.name || "Товар не найден" };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = getProduct((await params).id) as unknown as Product | null;
  if (!p) notFound();
  const category = p.categories?.at(-1);
  return (
    <div className="shell">
      <div className="page-heading">
        <div className="breadcrumbs">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/catalog">Каталог</Link>
          {category && (
            <>
              <span>/</span>
              <Link href={`/catalog?category=${category.id}`}>
                {category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span>{p.name}</span>
        </div>
      </div>
      <ProductBuy product={p} />
      <nav className="product-tabs">
        <a href="#description">Описание</a>
        <a href="#specifications">Характеристики</a>
        <a href="#documents">Документы</a>
        <Link href="/delivery">Доставка и оплата</Link>
      </nav>
      <section className="product-description" id="description">
        <h2>О товаре</h2>
        <p>
          {p.description ||
            "Описание пока не предоставлено производителем. Специалисты ANADO помогут уточнить назначение и совместимость оборудования."}
        </p>
      </section>
      <section className="product-description" id="specifications">
        <h2>Характеристики</h2>
        {p.tables?.length ? (
          p.tables.map((table, t) => {
            const columns = Math.max(
              1,
              ...table.map((row) =>
                row.reduce(
                  (total, cell) => total + Math.min(cell.colspan || 1, 20),
                  0,
                ),
              ),
            );
            const wide = columns > 2;
            return (
              <div
                className="spec-table-wrap"
                key={t}
                role={wide ? "region" : undefined}
                aria-label={
                  wide ? `Характеристики, таблица ${t + 1}` : undefined
                }
                tabIndex={wide ? 0 : undefined}
              >
                <table
                  className={`spec-table${wide ? " spec-table-wide" : ""}`}
                  style={{ "--spec-columns": columns } as CSSProperties}
                >
                  <tbody>
                    {table.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            colSpan={Math.min(cell.colspan || 1, 20)}
                            rowSpan={Math.min(cell.rowspan || 1, 100)}
                          >
                            {cell.text}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        ) : (
          <p>
            {p.specs ||
              "Характеристики в исходном каталоге не указаны. Уточните их у специалиста перед покупкой."}
          </p>
        )}
      </section>
      <section className="product-description" id="documents">
        <h2>Документы</h2>
        {p.documents?.length ? (
          <div className="product-documents">
            {p.documents.map((d) => (
              <a
                key={d.source_url}
                href={d.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText size={17} /> {d.name}
              </a>
            ))}
          </div>
        ) : (
          <p>
            Документы пока не добавлены. Запросите инструкцию или техническую
            документацию у менеджера.
          </p>
        )}
      </section>
      <p className="source-note">
        Данные перенесены из{" "}
        <a href={p.source} target="_blank" rel="noopener noreferrer">
          каталога ANADO
        </a>
        . Комплектация, цена и наличие требуют подтверждения.
      </p>
    </div>
  );
}
