import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import {
  adminSetupState,
  adminSetupProblem,
  isAdminSetupOwner,
} from "@/lib/admin-setup.mjs";
import { AdminSetupForm } from "@/components/admin-setup-form";
import { Logout } from "@/components/auth-form";
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
          {user ? (
            <Logout next="admin" label="Войти в аккаунт администратора" />
          ) : (
            <Link href="/login?next=admin">Войти</Link>
          )}
        </div>
      ) : state === "disabled" ? (
        <div className="account-panel">
          <p role="alert">{adminSetupProblem()}</p>
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
      ) : !isAdminSetupOwner(user) ? (
        <div className="account-panel">
          <p>
            Вы вошли как <strong>{String(user.email)}</strong>.
          </p>
          <p role="alert">
            Email этого аккаунта не совпадает с ADMIN_SETUP_EMAIL в Render.
          </p>
          <p>
            Войдите в аккаунт с email, который вы указали в настройках Render.
          </p>
          <Logout next="admin-setup" label="Войти в другой аккаунт" />
        </div>
      ) : (
        <AdminSetupForm email={String(user.email)} />
      )}
    </div>
  );
}
