import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { adminSetupState } from "@/lib/admin-setup.mjs";
import { AdminSetupForm } from "@/components/admin-setup-form";
export const metadata = {
  title: "Настройка администратора",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentUser(),
    state = adminSetupState();
  if (user?.role === "admin") redirect("/admin");
  return (
    <div className="shell account-page">
      <h1>Настройка администратора</h1>
      {state === "complete" ? (
        <div className="account-panel">
          <p>
            Администратор уже назначен. Войдите в аккаунт администратора, чтобы
            открыть панель.
          </p>
          <Link href="/login">Войти</Link>
        </div>
      ) : state === "disabled" ? (
        <div className="account-panel">
          <p>
            В Render откройте свой сервис → Environment и добавьте две
            переменные:
          </p>
          <p>
            <strong>ADMIN_SETUP_EMAIL</strong> — email вашего аккаунта на сайте.
            <br />
            <strong>ADMIN_SETUP_TOKEN</strong> — случайный секретный ключ от 32
            до 256 символов без пробелов.
          </p>
          <p>
            Сохраните изменения с перезапуском сервиса, затем вернитесь на эту
            страницу.
          </p>
        </div>
      ) : !user ? (
        <div className="account-panel">
          <p>Войдите в аккаунт, которому хотите выдать права администратора.</p>
          <div className="account-actions">
            <Link href="/login?next=admin-setup">Войти</Link>
            <Link href="/register?next=admin-setup">Зарегистрироваться</Link>
          </div>
        </div>
      ) : (
        <AdminSetupForm email={String(user.email)} />
      )}
    </div>
  );
}
