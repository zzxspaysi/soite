import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { businessSections, businessHref } from "@/lib/business-sections";
function findSector(id: string) {
  const section = businessSections.find((s) =>
    s.items.some((i) => i.id === id),
  );
  const item = section?.items.find((i) => i.id === id);
  return section && item ? { section, item } : null;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const found = findSector((await params).sector);
  return { title: found?.item.title || "Решение не найдено" };
}
export default async function SolutionPage({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const found = findSector((await params).sector);
  if (!found) notFound();
  const { section, item } = found;
  return (
    <div className="shell content-page sector-page">
      <div className="page-heading">
        <div className="breadcrumbs">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/solutions">Решения для бизнеса</Link>
        </div>
        <div className="eyebrow">{section.title}</div>
        <h1>{item.title}</h1>
        <p className="page-intro">{section.intro}</p>
      </div>
      <div className="info-card">
        <h2>Подберём под ваши задачи</h2>
        <p>
          Расскажите о формате бизнеса, количестве рабочих мест и используемых
          программах. Специалисты ANADO уточнят совместимость оборудования,
          состав решения и условия подключения.
        </p>
        <div className="sector-actions">
          <Link
            className="btn btn-blue"
            href={`/catalog?category=${section.category}`}
          >
            Посмотреть оборудование <ArrowUpRight size={18} />
          </Link>
          <Link className="btn btn-outline" href="/contacts">
            Обсудить задачу
          </Link>
        </div>
      </div>
      <nav className="sector-related" aria-label="Другие решения">
        {section.items
          .filter((i) => i.id !== item.id)
          .map((i) => (
            <Link key={i.id} href={businessHref(i)}>
              {i.title}
              <ArrowUpRight size={16} />
            </Link>
          ))}
      </nav>
    </div>
  );
}
