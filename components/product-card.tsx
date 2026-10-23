import Link from "next/link";
import { ArrowUpRight, Package } from "lucide-react";
import { formatMoney, type Product } from "@/lib/types";
export function ProductCard({ product: p }: { product: Product }) {
  return (
    <Link href={`/product/${p.id}`} className="product-card">
      <div className="product-photo">
        {p.archived ? (
          <span className="tag tag-muted">Архив</span>
        ) : (
          <span className="tag">Оборудование</span>
        )}
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            width="290"
            height="200"
          />
        ) : (
          <div className="no-image">
            <Package size={48} />
            <span>Фото уточняется</span>
          </div>
        )}
        <span className="product-arrow">
          <ArrowUpRight size={21} />
        </span>
      </div>
      <div className="product-card-body">
        <span className="product-meta">
          {p.offer_count}{" "}
          {p.offer_count === 1 ? "комплектация" : "комплектаций"}
        </span>
        <h3>{p.name}</h3>
        <div className="product-card-price">
          {p.archived ? (
            "Уточнить аналог"
          ) : (
            <>
              {p.offer_count > 1 && p.price !== null ? "от " : ""}
              {formatMoney(p.price)}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
