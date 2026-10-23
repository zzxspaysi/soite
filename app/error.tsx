"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="shell section">
      <div className="empty-state">
        <h2>Не удалось загрузить страницу</h2>
        <p>Попробуйте обновить её через несколько секунд.</p>
        <button className="btn btn-blue" onClick={reset}>
          Повторить
        </button>
      </div>
    </div>
  );
}
