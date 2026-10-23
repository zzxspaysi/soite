"use client";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Trash2, Package } from "lucide-react";
import { useStore } from "./store-provider";
import { formatMoney } from "@/lib/types";
export function Cart({ mode }: { mode: string }) {
  const { items, ready, setQuantity } = useStore();
  if (!ready) return <div className="loading">Загружаем корзину…</div>;
  if (!items.length)
    return (
      <div className="empty-state" style={{ marginBottom: 60 }}>
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
  return (
    <div className="cart-layout">
      <div>
        {items.map((i) => (
          <div className="cart-row" key={i.offerId}>
            <Link href={`/product/${i.productId}`}>
              {i.image ? (
                <img src={i.image} alt={i.name} />
              ) : (
                <Package size={45} />
              )}
            </Link>
            <div>
              <Link href={`/product/${i.productId}`}>
                <h3>{i.name}</h3>
              </Link>
              <p>{i.variant}</p>
              <div className="quantity">
                <button
                  onClick={() => setQuantity(i.offerId, i.quantity - 1)}
                  aria-label={`Уменьшить количество ${i.name}`}
                >
                  −
                </button>
                <span>{i.quantity}</span>
                <button
                  onClick={() => setQuantity(i.offerId, i.quantity + 1)}
                  aria-label={`Увеличить количество ${i.name}`}
                >
                  +
                </button>
              </div>
            </div>
            <div className="cart-row-end">
              <span className="cart-row-price">
                {formatMoney(i.price === null ? null : i.price * i.quantity)}
              </span>
              <button
                className="remove-button"
                onClick={() => setQuantity(i.offerId, 0)}
              >
                <Trash2 size={13} />
                Удалить
              </button>
            </div>
          </div>
        ))}
        <p className="price-disclaimer">
          Перед оформлением проверим состав и цены заказа.
        </p>
      </div>
      <aside className="order-summary">
        <h2>Ваш заказ</h2>
        <div className="summary-line">
          <span>Товаров</span>
          <span>{items.reduce((s, i) => s + i.quantity, 0)}</span>
        </div>
        <div className="summary-line">
          <span>Доставка</span>
          <span>По согласованию</span>
        </div>
        <div className="summary-line total">
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
