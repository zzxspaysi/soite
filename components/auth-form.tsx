"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
export function AuthForm({
  register = false,
  next = "account",
}: {
  register?: boolean;
  next?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/" + (register ? "register" : "login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
          name: f.get("name"),
          consent: f.get("consent") === "on",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      window.location.assign(
        next === "checkout"
          ? "/checkout"
          : next === "admin-setup"
            ? "/admin/setup"
            : "/account",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа");
      setBusy(false);
    }
  }
  return (
    <form className="account-panel auth-form" onSubmit={submit}>
      {register && (
        <label>
          Ваше имя
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
          />
        </label>
      )}
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          maxLength={150}
          autoComplete="email"
        />
      </label>
      <label>
        Пароль
        <input
          name="password"
          type="password"
          required
          minLength={register ? 12 : 1}
          maxLength={128}
          autoComplete={register ? "new-password" : "current-password"}
        />
      </label>
      {register && (
        <>
          <p>Используйте пароль от 12 символов.</p>
          <label className="consent-label">
            <input name="consent" type="checkbox" required />
            <span>
              Согласен на обработку данных согласно{" "}
              <Link href="/privacy">политике конфиденциальности</Link>.
            </span>
          </label>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-blue" disabled={busy}>
        {busy ? "Подождите…" : register ? "Зарегистрироваться" : "Войти"}
      </button>
      <Link
        href={
          (register ? "/login" : "/register") +
          (["checkout", "admin-setup"].includes(next) ? "?next=" + next : "")
        }
      >
        {register ? "Уже есть аккаунт? Войти" : "Создать аккаунт"}
      </Link>
    </form>
  );
}
export function Logout() {
  return (
    <button
      className="btn btn-outline"
      onClick={async () => {
        const r = await fetch("/api/auth/logout", { method: "POST" });
        if (r.ok) window.location.assign("/login");
      }}
    >
      Выйти
    </button>
  );
}
export function PrintInvoice() {
  return (
    <button className="btn btn-blue no-print" onClick={() => window.print()}>
      Печать / сохранить PDF
    </button>
  );
}
