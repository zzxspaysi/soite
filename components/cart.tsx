"use client";
import Link from "next/link";
import { ArrowRight, ShoppingBag, X, Package } from "lucide-react";
import { useStore } from "./store-provider";
import { formatMoney } from "@/lib/types";
export function Cart({ mode }: { mode: string }) {
  const { items, ready, setQuantity, clear } = useStore();
  if (!ready) return <div className="loading">Загружаем корзину…</div>;
  if (!items.length)
    return (
      <div className="empty-state cart-empty" style={{ marginBottom: 60 }}>
        <ShoppingBag size={50} />
        <h2>Начнём с оборудования</h2>
        <p>
          Добавьте нужные товары из каталога. Поможем выбрать комплектацию и
          оформить заказ.
        </p>
        <Link href="/catalog" className="btn btn-blue">
          Перейти в каталог <ArrowRight size={18} />
        </Link>
      </div>
    );
  const total = items.reduce((s, i) => s + (i.price || 0) * i.quantity, 0),
    hasQuote = items.some((i) => i.price === null);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const noun = {
    one: "товар",
    few: "товара",
    many: "товаров",
    other: "товара",
  }[
    new Intl.PluralRules("ru").select(count) as "one" | "few" | "many" | "other"
  ];
  return (
    <div className="cart-layout">
      <section className="cart-products" aria-label="Товары в корзине">
        <div className="cart-products-heading">
          <h2 aria-live="polite">
            {count} {noun}
          </h2>
          <button type="button" className="cart-clear" onClick={clear}>
            Удалить все
          </button>
        </div>
        {items.map((i) => (
          <article className="cart-row" key={i.offerId}>
            <Link
              className="cart-product-image"
              href={`/product/${i.productId}`}
              aria-label={i.name}
            >
              {i.image ? (
                <img src={i.image} alt="" width="140" height="140" />
              ) : (
                <Package size={45} aria-hidden="true" />
              )}
            </Link>
            <div className="cart-product-content">
              <Link href={`/product/${i.productId}`}>
                <h3>{i.name}</h3>
              </Link>
              {i.variant && <p className="cart-variant">{i.variant}</p>}
            </div>
            <div className="cart-row-bottom">
              <span className="cart-row-price" aria-live="polite">
                {formatMoney(i.price === null ? null : i.price * i.quantity)}
              </span>
              <div className="cart-row-actions">
                <div
                  className="quantity"
                  role="group"
                  aria-label={`Количество ${i.name}`}
                >
                  <button
                    type="button"
                    onClick={() => setQuantity(i.offerId, i.quantity - 1)}
                    aria-label={`Уменьшить количество ${i.name}`}
                  >
                    −
                  </button>
                  <span aria-live="polite">{i.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(i.offerId, i.quantity + 1)}
                    disabled={i.quantity >= 99}
                    aria-label={`Увеличить количество ${i.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="remove-button"
                onClick={() => setQuantity(i.offerId, 0)}
                aria-label={`Удалить ${i.name}`}
                title="Удалить товар"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
        <p className="price-disclaimer">
          Перед оформлением проверим состав и цены заказа.
        </p>
      </section>
      <aside className="order-summary" aria-label="Сумма заказа">
        <h2>Сумма заказа</h2>
        <div className="summary-line">
          <span>
            {count} {noun} на сумму
          </span>
          <span>{formatMoney(total)}</span>
        </div>
        <div className="summary-line">
          <span>Доставка</span>
          <span>По согласованию</span>
        </div>
        <div className="summary-line total" aria-live="polite">
          <span>{hasQuote ? "Известная сумма" : "Итого"}</span>
          <span>{formatMoney(total)}</span>
        </div>
        {hasQuote && (
          <p className="summary-note">
            Для части позиций стоимость уточнит менеджер. Онлайн-оплата будет
            доступна после согласования.
          </p>
        )}
        <Link href="/checkout" className="btn btn-blue">
          Оформить заказ <ArrowRight size={18} />
        </Link>
        <p className="summary-note">
          Карты и СБП через ЮKassa · Оплата по счёту
        </p>
        {mode === "demo" && (
          <p className="demo-notice">
            Демонстрационный магазин. Деньги не списываются.
          </p>
        )}
      </aside>
    </div>
  );
}
