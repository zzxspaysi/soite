"use client";
import { useState, type FormEvent } from "react";
export function AdminSetupForm({ email }: { email: string }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.get("token"),
          password: data.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      form.reset();
      window.location.assign("/admin");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось завершить настройку.",
      );
      setBusy(false);
    }
  }
  return (
    <form className="account-panel auth-form" onSubmit={submit}>
      <p>
        Права администратора будут выданы аккаунту <strong>{email}</strong>.
      </p>
      <label>
        Пароль вашего аккаунта
        <input
          name="password"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
        />
      </label>
      <label>
        Ключ настройки
        <input
          name="token"
          type="password"
          required
          minLength={32}
          maxLength={256}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
        />
      </label>
      <p>
        Используйте ключ, который вы сохранили в настройках Render. После
        назначения первого администратора повторная настройка будет закрыта.
      </p>
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-blue" disabled={busy}>
        {busy ? "Сохраняем…" : "Назначить администратором"}
      </button>
    </form>
  );
}
