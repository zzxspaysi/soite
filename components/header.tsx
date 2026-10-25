"use client";
import Link from "next/link";
import { businessSections, businessHref } from "@/lib/business-sections";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  MapPin,
  Menu,
  Search,
  UserRound,
  ShoppingBag,
  X,
  ChevronDown,
  Phone,
  ArrowRight,
} from "lucide-react";
import type { Category } from "@/lib/types";
import { useStore } from "./store-provider";
export function Header({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(false),
    [navigation, setNavigation] = useState<string | null>(null),
    [active, setActive] = useState(categories[0]?.id);
  const pathname = usePathname(),
    { items, ready } = useStore(),
    panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(false);
    setSearch(false);
    setNavigation(null);
  }, [pathname]);
  useEffect(() => {
    if (!open && !search && !navigation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch(false);
        setNavigation(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, search, navigation]);
  const roots = categories.filter((c) => !c.parent),
    current = roots.find((c) => c.id === active);
  return (
    <header className="site-header">
      <div className="shell nav-row">
        <Link href="/" className="brand" aria-label="АНАДО — главная">
          <img
            src="/brand/anado-original.png"
            alt="ANADO"
            width="178"
            height="49"
          />
          <span>Технологии вашего бизнеса</span>
        </Link>
        <button
          className={`catalog-toggle ${open ? "active" : ""}`}
          onClick={() => {
            setNavigation(null);
            setOpen(!open);
            setSearch(false);
          }}
          aria-expanded={open}
          aria-controls="catalog-menu"
        >
          {open ? <X size={19} /> : <Menu size={19} />} Каталог{" "}
          <ChevronDown size={14} />
        </button>
        <nav className="industry-nav" aria-label="Решения для бизнеса">
          {businessSections.slice(0, 5).map((section) => (
            <div
              className="industry-item"
              key={section.id}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setNavigation(section.id);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setNavigation(null);
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setNavigation(null);
              }}
            >
              <button
                aria-expanded={navigation === section.id}
                aria-controls={`nav-${section.id}`}
                onClick={() => {
                  setNavigation(navigation === section.id ? null : section.id);
                  setOpen(false);
                  setSearch(false);
                }}
              >
                {section.id === "logistics"
                  ? "Склады и логистика"
                  : section.id === "ecommerce"
                    ? "E-com"
                    : section.title}
                {section.items.length > 1 && <ChevronDown size={13} />}
              </button>
              <div
                className={`industry-dropdown ${navigation === section.id ? "is-open" : ""}`}
                id={`nav-${section.id}`}
                inert={navigation !== section.id}
                aria-hidden={navigation !== section.id}
              >
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    href={businessHref(item)}
                    onClick={() => setNavigation(null)}
                  >
                    {item.title}
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <Link className="header-buy" href="/catalog">
          Купить
        </Link>
        <div
          className="industry-item support-nav"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setNavigation("support");
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setNavigation(null);
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setNavigation(null);
          }}
        >
          <button
            aria-expanded={navigation === "support"}
            aria-controls="nav-support"
            onClick={() => {
              setNavigation(navigation === "support" ? null : "support");
              setOpen(false);
              setSearch(false);
            }}
          >
            Поддержка <ChevronDown size={13} />
          </button>
          <div
            className={`industry-dropdown ${navigation === "support" ? "is-open" : ""}`}
            id="nav-support"
            inert={navigation !== "support"}
            aria-hidden={navigation !== "support"}
          >
            <Link href="/services">Сервис и услуги</Link>
            <Link href="/contacts">Контакты</Link>
            <Link href="/delivery">Доставка и оплата</Link>
            <Link href="/about">О компании</Link>
          </div>
        </div>
        <div className="nav-actions">
          <Link
            href="/account"
            className="icon-button"
            aria-label="Личный кабинет"
          >
            <UserRound size={21} />
          </Link>
          <button
            className="icon-button"
            aria-label="Поиск по каталогу"
            aria-expanded={search}
            onClick={() => {
              setNavigation(null);
              setSearch(!search);
              setOpen(false);
            }}
          >
            {search ? <X /> : <Search size={21} />}
          </button>
          <Link
            href="/cart"
            className="cart-link"
            aria-label={`Корзина, ${ready ? items.reduce((s, x) => s + x.quantity, 0) : 0} товаров`}
          >
            <ShoppingBag size={22} />
            <span className="cart-label">Корзина</span>
            {ready && items.length > 0 && (
              <b>{items.reduce((s, x) => s + x.quantity, 0)}</b>
            )}
          </Link>
        </div>
      </div>
      {search && (
        <div className="search-panel shell">
          <form action="/catalog">
            <Search size={24} />
            <input
              autoFocus
              name="q"
              placeholder="Название, модель или артикул товара"
              aria-label="Поиск товара"
            />
            <button className="btn btn-blue">
              Найти <ArrowRight size={18} />
            </button>
          </form>
          <p>Например: АТОЛ 30Ф, сканер, принтер этикеток</p>
        </div>
      )}
      {open && (
        <>
          <button
            className="menu-backdrop"
            onClick={() => setOpen(false)}
            aria-label="Закрыть каталог"
          />
          <div className="mega-menu shell" id="catalog-menu" ref={panel}>
            <div className="mega-roots">
              {roots.map((c) => (
                <button
                  key={c.id}
                  className={c.id === active ? "selected" : ""}
                  onClick={() => setActive(c.id)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setActive(c.id);
                  }}
                  onFocus={() => setActive(c.id)}
                  aria-pressed={c.id === active}
                  aria-controls="catalog-subcategories"
                >
                  {c.name}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
            <div
              className="mega-children"
              id="catalog-subcategories"
              key={active}
            >
              <div className="eyebrow">Каталог ANADO</div>
              <h2>{current?.name}</h2>
              <Link
                className="text-link"
                href={`/catalog?category=${active}`}
                onClick={() => setOpen(false)}
              >
                Все товары раздела <ArrowRight size={17} />
              </Link>
              <div>
                {categories
                  .filter((c) => c.parent === active)
                  .map((c) => (
                    <Link
                      key={c.id}
                      href={`/catalog?category=${c.id}`}
                      onClick={() => setOpen(false)}
                    >
                      {c.name}
                      <span>{c.count}</span>
                    </Link>
                  ))}
              </div>
              <Link className="mega-help" href="/contacts">
                Поможем с выбором оборудования <ArrowUpRight />
              </Link>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
