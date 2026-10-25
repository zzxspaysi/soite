import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { db, money } from "@/lib/db.mjs";
import { AdminImport } from "@/components/admin-import";
import { safeExternalUrl } from "@/lib/urls.mjs";
export const metadata = {
  title: "Управление магазином",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") notFound();
  const orders = db
    .prepare(
      "SELECT id,created_at,customer_json,total,status,mode,exported_at FROM orders ORDER BY created_at DESC LIMIT 100",
    )
    .all();
  const batches = db
    .prepare("SELECT * FROM sync_batches ORDER BY created_at DESC LIMIT 10")
    .all();
  const web = safeExternalUrl(process.env.ONE_C_WEB_URL);
  return (
    <div className="shell account-page">
      <h1>Управление магазином</h1>
      <section className="account-panel">
        <h2>1С:Управление торговлей</h2>
        <p>
          {(process.env.ONE_C_TOKEN?.length ?? 0) >= 24
            ? "Ключ обмена настроен."
            : "Ключ обмена ещё не настроен."}{" "}
          Режим магазина:{" "}
          {process.env.PAYMENT_MODE === "live" ? "рабочий" : "демонстрационный"}
          .
        </p>
        {web && web.startsWith("https://") && (
          <a
            href={web}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-blue"
          >
            Открыть рабочую 1С
          </a>
        )}
        <p>
          Для автоматического обмена настройте регламентное задание в 1С. Вход в
          опубликованную базу выполняется на странице самой 1С.
        </p>
        <p>
          Цены и названия: /api/integrations/1c/inventory · Заказы:
          /api/integrations/1c/orders · Счета: /api/integrations/1c/invoices
        </p>
      </section>
      <AdminImport />
      <section className="account-panel">
        <h2>Последние загрузки</h2>
        {batches.length ? (
          batches.map((b) => (
            <p key={String(b.id)}>
              {String(b.id)} · {String(b.created_at)}
            </p>
          ))
        ) : (
          <p>Обмен ещё не выполнялся.</p>
        )}
      </section>
      <h2>Последние заказы</h2>
      {orders.map((o) => {
        const c = JSON.parse(String(o.customer_json));
        return (
          <article className="account-panel" key={String(o.id)}>
            <h2>{String(o.id)}</h2>
            <p>
              {c.name} · {c.company} · {c.email} · {c.phone}
            </p>
            <p>
              {money(Number(o.total))} · {String(o.status)} ·{" "}
              {o.mode === "demo"
                ? "Тестовый заказ"
                : o.exported_at
                  ? "Передан в 1С"
                  : "Ожидает выгрузки"}
            </p>
          </article>
        );
      })}
    </div>
  );
}
