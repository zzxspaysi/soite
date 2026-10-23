"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, ShoppingBag } from "lucide-react";
import { useStore } from "./store-provider";
import { formatMoney, type CartItem } from "@/lib/types";
type Quote = { items: CartItem[]; total: number; needsQuote: boolean };
export function Checkout({ mode }: { mode: string }) {
  const { items, ready } = useStore(),
    router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [delivery, setDelivery] = useState("pickup"),
    [payment, setPayment] = useState("bank_card");
  const requestKey = useRef({ fingerprint: "", id: "" });
  useEffect(() => {
    if (!ready || !items.length) return;
    const abort = new AbortController();
    setQuote(null);
    fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal: abort.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setQuote(data);
        if (data.needsQuote) setPayment("invoice");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [items, ready]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quote) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget),
      body = {
        expectedTotal: quote.total,
        items: items.map((i) => ({ offerId: i.offerId, quantity: i.quantity })),
        paymentMethod: payment,
        customer: {
          name: data.get("name"),
          phone: data.get("phone"),
          email: data.get("email"),
          company: data.get("company"),
          delivery,
          address: data.get("address"),
          consent: data.get("consent") === "on",
        },
      };
    const fingerprint = JSON.stringify(body);
    try {
      if (requestKey.current.fingerprint !== fingerprint) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        requestKey.current = {
          fingerprint,
          id: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
            "",
          ),
        };
      }
      const r = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, idempotency: requestKey.current.id }),
        }),
        result = await r.json();
      if (!r.ok) throw Error(result.error);
      router.push(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось оформить заказ");
      setBusy(false);
    }
  }
  if (!ready) return <div className="loading">Проверяем заказ…</div>;
  if (!items.length)
    return (
      <div className="empty-state" style={{ marginBottom: 60 }}>
        <ShoppingBag size={45} />
        <h2>В корзине пока пусто</h2>
        <p>Добавьте оборудование, чтобы перейти к оформлению.</p>
        <Link href="/catalog" className="btn btn-blue">
          В каталог <ArrowRight size={18} />
        </Link>
      </div>
    );
  return (
    <>
      {mode === "demo" && (
        <div className="demo-notice">
          Демонстрационный режим: можно пройти весь путь заказа и проверить
          оплату. Деньги не списываются, заказ в ANADO не отправляется.
        </div>
      )}
      <form className="checkout-layout" onSubmit={submit}>
        <div className="checkout-form">
          <section className="form-section">
            <h2>
              <span>1</span>Контактные данные
            </h2>
            <div className="form-fields">
              <label>
                Ваше имя *
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Иван Иванов"
                />
              </label>
              <label>
                Телефон *
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  minLength={10}
                  maxLength={30}
                  placeholder="+7 (999) 000-00-00"
                />
              </label>
              <label>
                Email для заказа и чека *
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={150}
                  placeholder="you@company.ru"
                />
              </label>
              <label>
                Организация / ИНН
                <input
                  name="company"
                  autoComplete="organization"
                  maxLength={200}
                  placeholder="Для юридических лиц"
                />
              </label>
            </div>
          </section>
          <section className="form-section">
            <h2>
              <span>2</span>Как получить заказ
            </h2>
            <div className="radio-options">
              <label className="radio-card">
                <input
                  type="radio"
                  name="delivery"
                  checked={delivery === "pickup"}
                  onChange={() => setDelivery("pickup")}
                />
                <span>
                  Самовывоз<small>Новосибирск</small>
                </span>
              </label>
              <label className="radio-card">
                <input
                  type="radio"
                  name="delivery"
                  checked={delivery === "courier"}
                  onChange={() => setDelivery("courier")}
                />
                <span>
                  Доставка<small>По согласованию</small>
                </span>
              </label>
            </div>
            {delivery === "pickup" ? (
              <p className="delivery-detail">
                ул. Гоголя, 15, ТЦ «Юпитер» или Горский м-н, 56/1.
                <br />
                Офис и время выдачи согласуем после оформления.
              </p>
            ) : (
              <div className="form-fields" style={{ marginTop: 20 }}>
                <label className="full">
                  Адрес доставки *
                  <input
                    name="address"
                    autoComplete="street-address"
                    minLength={8}
                    maxLength={500}
                    required
                    placeholder="Город, улица, дом, офис"
                  />
                </label>
                <p className="summary-note">
                  Доставка оплачивается отдельно по согласованному тарифу. В
                  сумму онлайн-платежа входит только оборудование.
                </p>
              </div>
            )}
          </section>
          <section className="form-section">
            <h2>
              <span>3</span>Способ оплаты
            </h2>
            <div className="radio-options">
              {[
                { id: "bank_card", name: "Банковская карта", sub: "ЮKassa" },
                { id: "sbp", name: "СБП", sub: "Приложение вашего банка" },
                { id: "invoice", name: "По счёту", sub: "После подтверждения" },
              ].map((p) => (
                <label className="radio-card" key={p.id}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === p.id}
                    disabled={quote?.needsQuote && p.id !== "invoice"}
                    onChange={() => setPayment(p.id)}
                  />
                  <span>
                    {p.name}
                    <small>{p.sub}</small>
                  </span>
                </label>
              ))}
            </div>
            {quote?.needsQuote && (
              <p className="delivery-detail">
                В заказе есть позиции с ценой по запросу. Менеджер уточнит
                стоимость и подготовит счёт.
              </p>
            )}
            <p className="summary-note">
              <LockKeyhole
                size={12}
                style={{ verticalAlign: "middle", marginRight: 5 }}
              />
              Данные карты вводятся на защищённой странице ЮKassa.
            </p>
          </section>
          <label className="consent-label">
            <input type="checkbox" name="consent" required />
            <span>
              Я согласен на обработку данных для оформления заказа и ознакомлен
              с{" "}
              <Link href="/privacy" target="_blank">
                условиями обработки персональных данных
              </Link>
              .
            </span>
          </label>
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
        </div>
        <aside className="order-summary">
          <h2>Ваш заказ</h2>
          {quote?.items.map((i) => (
            <div className="summary-line" key={i.offerId}>
              <span>
                {i.name} × {i.quantity}
              </span>
              <span style={{ whiteSpace: "nowrap" }}>
                {formatMoney(i.price === null ? null : i.price * i.quantity)}
              </span>
            </div>
          ))}
          {!quote && (
            <p className="summary-note">Проверяем цены и комплектации…</p>
          )}
          <div className="summary-line total">
            <span>{quote?.needsQuote ? "Известная сумма" : "Итого"}</span>
            <span>{formatMoney(quote?.total ?? 0)}</span>
          </div>
          <p className="summary-note">
            Доставка — по согласованию, оплачивается отдельно.
          </p>
          <button className="btn btn-blue" disabled={busy || !quote}>
            {busy
              ? "Оформляем…"
              : mode === "demo"
                ? "Создать тестовый заказ"
                : payment === "invoice"
                  ? "Отправить заказ"
                  : "Перейти к оплате"}
            <ArrowRight size={18} />
          </button>
          <p className="summary-note">
            {mode === "demo"
              ? "Сейчас используется тестовый сценарий без реального списания."
              : "Цена и наличие проверяются перед оплатой."}
          </p>
          <Link
            href="/cart"
            className="text-link"
            style={{ fontSize: 11, marginTop: 20 }}
          >
            Вернуться в корзину
          </Link>
        </aside>
      </form>
    </>
  );
}
