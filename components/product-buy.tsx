"use client";
import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Truck, ShieldCheck, Package } from "lucide-react";
import { type Product, formatMoney } from "@/lib/types";
import { useStore } from "./store-provider";
export function ProductBuy({ product: p }: { product: Product }) {
  const [selected, setSelected] = useState(
      p.offers?.find((o) => o.price !== null)?.id || p.offers?.[0]?.id || "",
    ),
    [quantity, setQuantity] = useState(1),
    [image, setImage] = useState(p.images?.[0] || p.image);
  const offer = p.offers?.find((o) => o.id === selected),
    { add } = useStore();
  return (
    <div className="product-detail">
      <div>
        <div className="product-gallery">
          {image ? (
            <img src={image} alt={p.name} width="500" height="500" />
          ) : (
            <div className="no-image">
              <Package size={65} />
              <span>Фотография пока не предоставлена</span>
            </div>
          )}
        </div>
        {(p.images?.length || 0) > 1 && (
          <div className="gallery-thumbs">
            {p.images?.map((src, i) => (
              <button
                className={src === image ? "active" : ""}
                onClick={() => setImage(src)}
                key={src}
                aria-label={`Фотография ${i + 1}`}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="product-buy">
        <div className="eyebrow">Оборудование ANADO</div>
        <h1>{p.name}</h1>
        <span className="product-meta">
          {offer?.sku ? `Артикул: ${offer.sku}` : `Код товара: ${p.id}`}
        </span>
        {p.archived ? (
          <div className="archive-note">
            Архивная модель. Поможем подобрать актуальную замену.
          </div>
        ) : null}
        {offer && (
          <>
            <label className="variant-label" htmlFor="variant">
              Комплектация · {p.offers?.length}
            </label>
            <select
              id="variant"
              className="variant-select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {p.offers?.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                  {o.sku ? ` · ${o.sku}` : ""}
                </option>
              ))}
            </select>
            <div className="product-price">{formatMoney(offer.price)}</div>
            <div className="stock-note">
              <i />
              {offer.stock !== null
                ? offer.stock > 0
                  ? "Наличие подтверждено"
                  : "Под заказ"
                : "Наличие и цену уточним при заказе"}
            </div>
          </>
        )}
        {p.archived || !offer ? (
          <Link
            href="/contacts"
            className="btn btn-blue"
            style={{ marginTop: 24 }}
          >
            Подобрать аналог <ShoppingBag size={18} />
          </Link>
        ) : (
          <div className="buy-actions">
            <div className="quantity">
              <button
                aria-label="Уменьшить количество"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                −
              </button>
              <span>{quantity}</span>
              <button
                aria-label="Увеличить количество"
                onClick={() => setQuantity(Math.min(99, quantity + 1))}
              >
                +
              </button>
            </div>
            <button
              className="btn btn-blue"
              onClick={() =>
                add({
                  offerId: offer.id,
                  productId: p.id,
                  name: p.name,
                  variant: offer.name,
                  image: p.image,
                  price: offer.price,
                  quantity,
                })
              }
            >
              {offer.price === null ? "Запросить стоимость" : "В корзину"}
              <ShoppingBag size={18} />
            </button>
          </div>
        )}
        <div className="product-benefits">
          <div>
            <Truck size={21} />
            <span>
              <b>Доставка и самовывоз</b>
              <small>Условия согласуем перед оплатой</small>
            </span>
          </div>
          <div>
            <ShieldCheck size={21} />
            <span>
              <b>Подключение и сервис</b>
              <small>Помощь специалистов ANADO</small>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
