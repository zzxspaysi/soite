"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { formatMoney, type CartItem } from "@/lib/types";
import { useStore } from "./store-provider";
type Order = {
  id: string;
  status: string;
  mode: string;
  items: CartItem[];
  total: number;
  paymentUrl?: string;
  customer: { name: string; email: string; delivery: string };
};
export function OrderResult({ id, token }: { id: string; token: string }) {
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const { clear } = useStore();
  async function refresh() {
    setBusy(true);
    try {
      const r = await fetch(
          `/api/orders/${id}?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        ),
        data = await r.json();
      if (!r.ok) throw Error(data.error);
      setOrder(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить заказ");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    refresh(); /* token-bound order is fetched only for this route */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);
  useEffect(() => {
    if (
      order &&
      ["paid", "demo_paid", "awaiting_confirmation"].includes(order.status)
    )
      clear();
  }, [order?.status]);
  async function demo() {
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/${id}/demo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }),
        data = await r.json();
      if (!r.ok) throw Error(data.error);
      setOrder(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка тестовой оплаты");
    } finally {
      setBusy(false);
    }
  }
  if (!order)
    return (
      <div className="empty-state" style={{ marginBottom: 60 }}>
        <h2>{error || "Загружаем заказ…"}</h2>
        <p>Доступ к заказу открыт только по вашей персональной ссылке.</p>
        <Link href="/catalog" className="btn btn-blue">
          В каталог
        </Link>
      </div>
    );
  const done = order.status === "paid" || order.status === "demo_paid",
    confirmed = order.status === "awaiting_confirmation",
    canceled = order.status === "canceled";
  return (
    <div className="order-result">
      <div className="order-status">
        {done ? <CheckCircle2 size={43} /> : <ShieldCheck size={43} />}
        <div className="eyebrow">
          {order.mode === "demo" ? "Демонстрационный заказ" : "Ваш заказ"}{" "}
          {order.id}
        </div>
        <h1>
          {done
            ? order.mode === "demo"
              ? "Тестовая оплата прошла"
              : "Заказ оплачен"
            : confirmed
              ? "Заказ сохранён"
              : canceled
                ? "Оплата отменена"
                : "Заказ готов к оплате"}
        </h1>
        <p>
          {order.mode === "demo"
            ? done
              ? "Вы прошли весь путь покупки. Деньги не списаны, тестовый заказ не передаётся в ANADO."
              : confirmed
                ? "Стоимость и наличие требуют согласования. В демонстрационном режиме обращение менеджеру не отправляется."
                : "Проверьте демонстрационный сценарий оплаты. Платёжные данные и настоящие деньги не используются."
            : done
              ? "Спасибо! Оплата подтверждена платёжным сервисом. Мы свяжемся с вами по поводу получения заказа."
              : confirmed
                ? "Менеджер подтвердит стоимость, наличие и условия получения."
                : canceled
                  ? "Деньги не списаны. Свяжитесь с менеджером для повторной оплаты."
                  : "Перейдите на защищённую страницу ЮKassa. После оплаты вернитесь сюда для проверки статуса."}
        </p>
      </div>
      <div className="order-details">
        <h2>Состав заказа</h2>
        {order.items.map((i) => (
          <div className="order-item" key={i.offerId}>
            <div>
              {i.name}
              <small>
                {i.variant} · {i.quantity} шт.
              </small>
            </div>
            <span style={{ whiteSpace: "nowrap" }}>
              {formatMoney(i.price === null ? null : i.price * i.quantity)}
            </span>
          </div>
        ))}
        <div className="summary-line total">
          <span>
            {order.items.some((i) => i.price === null)
              ? "Известная сумма"
              : "Итого"}
          </span>
          <span>{formatMoney(order.total)}</span>
        </div>
        <p className="summary-note">
          Получатель: {order.customer.name} · {order.customer.email}
          <br />
          {order.customer.delivery === "pickup"
            ? "Самовывоз в Новосибирске"
            : "Доставка по согласованию"}
        </p>
        <div className="order-actions">
          {order.status === "pending" &&
            (order.mode === "demo" ? (
              <button onClick={demo} disabled={busy} className="btn btn-blue">
                Проверить тестовую оплату <ArrowUpRight size={18} />
              </button>
            ) : (
              order.paymentUrl && (
                <a
                  href={order.paymentUrl}
                  className="btn btn-blue"
                  rel="noreferrer"
                >
                  Оплатить через ЮKassa <ArrowUpRight size={18} />
                </a>
              )
            ))}
          {order.mode === "live" && order.status === "pending" && (
            <button
              className="btn btn-outline"
              onClick={refresh}
              disabled={busy}
            >
              <RefreshCw size={16} />
              Проверить оплату
            </button>
          )}
          <Link href="/catalog" className="btn btn-outline">
            Продолжить покупки
          </Link>
        </div>
        {error && (
          <p className="error-message" role="alert" style={{ marginTop: 20 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
