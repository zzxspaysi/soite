import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { ownedOrder } from "@/lib/accounts.mjs";
import { db, money } from "@/lib/db.mjs";
import { PrintInvoice } from "@/components/auth-form";
const taxMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
  }).format(value / 100);
export const metadata = {
  title: "Счёт на оплату",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const o = ownedOrder((await params).id, user);
  if (!o) notFound();
  const inv = db
    .prepare("SELECT * FROM order_invoices WHERE order_id=?")
    .get(o.id);
  const customer = JSON.parse(String(o.customer_json)),
    items = JSON.parse(String(o.items_json)),
    demo = o.mode === "demo";
  if (
    items.some((i: { price: number | null }) => i.price === null) ||
    (!demo && !inv)
  )
    return (
      <div className="shell account-page">
        <h1>Счёт готовится</h1>
        <p>
          После подтверждения стоимости и получения номера из 1С счёт появится
          здесь автоматически.
        </p>
        <Link href="/account">Мои заказы</Link>
      </div>
    );
  const number = inv?.number || "ДЕМО-" + o.id,
    date = inv?.issued_at || o.created_at;
  const taxes = inv
    ? JSON.parse(String(inv.taxes_json))
    : items.map(() => ({ label: "Тестовый расчёт", amountKopecks: 0 }));
  return (
    <div className="shell">
      <div className="account-actions no-print">
        <Link href="/account">Мои заказы</Link>
        <PrintInvoice />
      </div>
      <article className="invoice-sheet">
        {demo && <h2>ОБРАЗЕЦ — НЕ ДЛЯ ОПЛАТЫ</h2>}
        <p>
          Счёт действителен в течение 3 банковских дней. Оплата означает
          согласие с условиями поставки. Отпуск товара — после поступления
          оплаты и согласования выдачи.
        </p>
        <h1>
          Счёт на оплату № {String(number)} от{" "}
          {new Date(String(date)).toLocaleDateString("ru-RU")}
        </h1>
        <p>
          Банк получателя: ФИЛИАЛ «НОВОСИБИРСКИЙ» АО «АЛЬФА-БАНК», г.
          Новосибирск
          <br />
          БИК 045004774 · Корр. счёт 30101810600000000774
          <br />
          Расчётный счёт 40702810423000006665
        </p>
        <p>
          <b>Поставщик:</b> ООО «Анадо», ИНН 5402500210, КПП 540601001. 630005,
          г. Новосибирск, ул. Гоголя, дом 15, этаж цоколь. Тел. +7 (383)
          349-90-05.
        </p>
        <p>
          <b>Покупатель:</b> {customer.company || customer.name}
          {customer.inn && `, ИНН ${customer.inn}`}
          {customer.kpp && `, КПП ${customer.kpp}`}
          <br />
          {customer.legalAddress || customer.address}
          <br />
          {customer.name}, {customer.phone}, {customer.email}
        </p>
        <p>
          <b>Назначение платежа:</b> Оплата по счёту № {String(number)}. Заказ{" "}
          {o.id}.
        </p>
        <div className="invoice-scroll">
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Артикул</th>
                <th>Товары (работы, услуги)</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>НДС</th>
                <th>Сумма НДС</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {items.map(
                (
                  i: {
                    sku?: string;
                    name: string;
                    variant?: string;
                    quantity: number;
                    price: number;
                  },
                  n: number,
                ) => (
                  <tr key={n}>
                    <td>{n + 1}</td>
                    <td>{i.sku || "—"}</td>
                    <td>{i.variant || i.name}</td>
                    <td>{i.quantity} шт.</td>
                    <td>{money(i.price)}</td>
                    <td>{taxes[n].label}</td>
                    <td>{taxMoney(taxes[n].amountKopecks)}</td>
                    <td>{money(i.price * i.quantity)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <p>Всего наименований: {items.length}</p>
        <p>
          В том числе НДС:{" "}
          {taxMoney(
            taxes.reduce(
              (sum: number, t: { amountKopecks: number }) =>
                sum + t.amountKopecks,
              0,
            ),
          )}
        </p>
        <h2>Итого к оплате: {money(o.total)}</h2>
        <p>Доставка в счёт не включена и согласуется отдельно.</p>
      </article>
    </div>
  );
}
