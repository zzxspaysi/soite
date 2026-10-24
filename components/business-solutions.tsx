"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Store,
  Coffee,
  Scissors,
  Warehouse,
  CloudUpload,
  MonitorSmartphone,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { businessSections, businessHref } from "@/lib/business-sections";
const icons = [
  Store,
  Coffee,
  Scissors,
  Warehouse,
  CloudUpload,
  MonitorSmartphone,
];
export function BusinessSolutions() {
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <section
      className="business-section shell"
      aria-labelledby="business-heading"
    >
      <div className="business-heading">
        <h2 id="business-heading">Решения для бизнеса</h2>
        <span aria-hidden="true">
          ANADO<span>•</span>
        </span>
      </div>
      <div className="business-grid">
        {businessSections.map((section, index) => {
          const Icon = icons[index];
          return (
            <article
              key={section.id}
              className={`business-card ${opened === section.id ? "is-open" : ""}`}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setOpened(section.id);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setOpened(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpened(null);
                  (
                    e.currentTarget.querySelector("button") as HTMLButtonElement
                  )?.focus();
                }
              }}
            >
              <button
                className="business-toggle"
                aria-expanded={opened === section.id}
                aria-controls={`business-links-${section.id}`}
                onClick={() =>
                  setOpened(opened === section.id ? null : section.id)
                }
              >
                {section.title}
                <Plus size={18} />
              </button>
              <div className="business-art" aria-hidden="true">
                <div className="business-plinth" />
                <Icon strokeWidth={1.15} />
                <span className="business-spark" />
              </div>
              <div
                className="business-links"
                id={`business-links-${section.id}`}
                inert={opened !== section.id}
              >
                {section.items.map((item) => (
                  <Link key={item.id} href={businessHref(item)}>
                    {item.title}
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
