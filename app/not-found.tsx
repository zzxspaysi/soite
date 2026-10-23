import Link from "next/link";
export default function NotFound() {
  return (
    <div className="shell section">
      <div className="empty-state">
        <div className="eyebrow" style={{ justifyContent: "center" }}>
          404
        </div>
        <h1 className="page-title">Страница не найдена</h1>
        <p>Вернёмся к выбору оборудования для вашего бизнеса.</p>
        <Link href="/catalog" className="btn btn-blue">
          В каталог →
        </Link>
      </div>
    </div>
  );
}
