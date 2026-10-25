import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { db } from "@/lib/db.mjs";
import { money } from "@/lib/db.mjs";
import { Logout } from "@/components/auth-form";
import { adminSetupState, isAdminSetupOwner } from "@/lib/admin-setup.mjs";
export const metadata = {
  title: "Мои заказы",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const orders = db
    .prepare(
      "SELECT id,created_at,total,status,mode FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 200",
    )
    .all(user.id);
  const labels: Record<string, string> = {
    awaiting_confirmation: "Ожидает подтверждения",
    pending: "Ожидает оплаты",
    paid: "Оплачен",
    demo_paid: "Тестовая оплата",
    canceled: "Отменён",
  };
  return (
    <div className="shell account-page">
      <h1>Мои заказы</h1>
      <p>
        {user.name} · {user.email}
      </p>
      <div className="account-actions">
        <Logout />
        {user.role === "admin" && <Link href="/admin">Администрирование</Link>}
        {user.role !== "admin" &&
          isAdminSetupOwner(user) &&
          adminSetupState() !== "complete" && (
            <Link href="/admin/setup">Настроить администратора</Link>
          )}
      </div>
      {!orders.length && (
        <div className="account-panel">
          Заказов пока нет. <Link href="/catalog">Перейти в каталог</Link>
        </div>
      )}
      {orders.map((o) => (
        <article className="account-panel" key={String(o.id)}>
          <h2>
            <Link href={"/order/" + o.id}>{String(o.id)}</Link>
          </h2>
          <p>
            {new Date(String(o.created_at)).toLocaleDateString("ru-RU")} ·{" "}
            {labels[String(o.status)] || "Обрабатывается"}{" "}
            {o.mode === "demo" && "· Демонстрационный заказ"}
          </p>
          <strong>{money(Number(o.total))}</strong>
          <div className="account-actions">
            <Link href={"/order/" + o.id}>Подробнее</Link>
            <Link href={"/account/invoice/" + o.id}>Счёт</Link>
          </div>
        </article>
      ))}
    </div>
  );
}
