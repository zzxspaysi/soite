"use client";
import { useState } from "react";
export function AdminImport() {
  const [result, setResult] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="account-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setResult("");
        const f = new FormData(e.currentTarget),
          file = f.get("file") as File;
        try {
          if (!file || file.size > 512000)
            throw Error("Размер JSON не должен превышать 512 КБ");
          const data = JSON.parse(await file.text());
          const r = await fetch("/api/admin/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          setResult(
            d.duplicate
              ? "Этот пакет уже загружен."
              : `Обновлено позиций: ${d.updated}`,
          );
        } catch (e) {
          setResult(e instanceof Error ? e.message : "Ошибка импорта");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Загрузить выгрузку из 1С</h2>
      <p>
        JSON с batchId и массивом offers: id варианта, priceKopecks, stock,
        необязательные name, productName, vatCode и paymentSubject. Используйте
        стабильные ID вариантов сайта.
      </p>
      <input name="file" type="file" accept="application/json,.json" required />
      <button className="btn btn-blue" disabled={busy}>
        {busy ? "Загрузка…" : "Обновить каталог"}
      </button>
      <p role="status">{result}</p>
    </form>
  );
}
