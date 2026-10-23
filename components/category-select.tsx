"use client";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types";
export function CategorySelect({
  categories,
  value,
}: {
  categories: Category[];
  value: string;
}) {
  const router = useRouter();
  return (
    <select
      className="mobile-category-select"
      aria-label="Раздел каталога"
      value={value}
      onChange={(e) =>
        router.push(
          e.target.value ? `/catalog?category=${e.target.value}` : "/catalog",
        )
      }
    >
      <option value="">Все разделы</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.parent ? "— " : ""}
          {c.name}
        </option>
      ))}
    </select>
  );
}
