"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  MapPin,
  Menu,
  Search,
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
    [active, setActive] = useState(categories[0]?.id);
  const pathname = usePathname(),
    { items, ready } = useStore(),
    panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(false);
    setSearch(false);
  }, [pathname]);
  useEffect(() => {
    if (!open && !search) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, search]);
  const roots = categories.filter((c) => !c.parent),
    current = roots.find((c) => c.id === active);
  return (
    <header className="site-header">
      <div className="topbar">
        <div className="shell topbar-inner">
          <span>
            <MapPin size={13} /> Новосибирск{" "}
            <span className="topbar-muted">
              Работаем с бизнесом по всей России
            </span>
          </span>
          <a href="tel:+73833495944">
            +7 (383) 349-59-44 <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
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
            setOpen(!open);
            setSearch(false);
          }}
          aria-expanded={open}
          aria-controls="catalog-menu"
        >
          {open ? <X size={19} /> : <Menu size={19} />} Каталог{" "}
          <ChevronDown size={14} />
        </button>
        <nav className="desktop-nav">
          <Link href="/solutions">Решения</Link>
          <Link href="/services">Сервис и услуги</Link>
          <Link href="/about">О компании</Link>
          <Link href="/contacts">Контакты</Link>
        </nav>
        <div className="nav-actions">
          <button
            className="icon-button"
            aria-label="Поиск по каталогу"
            aria-expanded={search}
            onClick={() => {
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
                >
                  {c.name}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
            <div className="mega-children">
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
