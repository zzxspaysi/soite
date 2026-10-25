"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Result = {
  browser: string;
  reducedMotion: boolean;
  mouse: boolean;
  slideTransition: string;
  stylesheets: number;
};

export function SiteDiagnostics({
  release,
  commit,
}: {
  release: string;
  commit: string | null;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Use the real carousel class to test the deployed CSS and browser preference.
    const container = document.createElement("div");
    container.className = "promo-carousel";
    const probe = document.createElement("div");
    probe.className = "promo-track is-moving";
    probe.style.cssText =
      "position:fixed;top:-9999px;width:1px;height:1px;visibility:hidden";
    probe.setAttribute("aria-hidden", "true");
    container.append(probe);
    document.body.append(container);
    const slideTransition = getComputedStyle(probe).transitionDuration;
    container.remove();
    setResult({
      browser: navigator.userAgent,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      mouse: matchMedia("(hover: hover) and (pointer: fine)").matches,
      slideTransition,
      stylesheets: document.styleSheets.length,
    });
  }, []);

  const report = [
    `Версия проверки: ${release}`,
    ...(commit ? [`Сборка: ${commit}`] : []),
    ...(result
      ? [
          "JavaScript: работает",
          `Уменьшение движения: ${result.reducedMotion ? "включено" : "выключено"}`,
          "Эффекты новостей: включены автоматически",
          `Указатель мыши: ${result.mouse ? "да" : "нет"}`,
          `Длительность перехода новостей: ${result.slideTransition}`,
          `Таблиц стилей: ${result.stylesheets}`,
          `Браузер: ${result.browser}`,
        ]
      : ["JavaScript: ожидаем запуска"]),
  ].join("\n");

  return (
    <section className="info-card">
      <h2>Проверка анимации новостей</h2>
      <p>
        Скопируйте результат и отправьте его в чат. Проверка читает настройки
        этого браузера и загруженные стили сайта.
      </p>
      <textarea
        aria-label="Результат проверки"
        readOnly
        value={report}
        rows={10}
        style={{ width: "100%", marginTop: 24, resize: "vertical" }}
      />
      <p role="status">
        {result
          ? result.slideTransition === "1.15s"
            ? "Плавная смена новостей включена автоматически, независимо от системной настройки уменьшения движения."
            : "Длительность перехода отличается от ожидаемой. Этот результат поможет найти причину."
          : "Если эта надпись не меняется, JavaScript на странице не запустился."}
      </p>
      <div className="sector-actions">
        <button
          type="button"
          className="btn btn-blue"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(report);
              setCopied(true);
            } catch {
              document.querySelector<HTMLTextAreaElement>("textarea")?.select();
            }
          }}
        >
          {copied ? "Скопировано" : "Скопировать результат"}
        </button>
        <Link href="/" className="btn btn-outline">
          На главную
        </Link>
      </div>
    </section>
  );
}
