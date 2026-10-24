"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Barcode,
  Layers3,
  Pause,
  Play,
  Printer,
  ScanLine,
} from "lucide-react";

const slides = [
  {
    id: "9fd456133525e745",
    name: "Эвотор 7.3",
    type: "Смарт-терминал",
    image: "/products/evotor-73.jpg",
    width: 500,
    height: 654,
    device: "terminal",
    word: "работает.",
    title: "Всё под контролем",
    detail: "Касса · Товары · Продажи",
    secondTitle: "Одна система",
    secondDetail: "Для всех процессов",
    icon: Barcode,
  },
  {
    id: "87b167eef0169767",
    name: "Mindeo MS3690 Mark",
    type: "Сканер штрихкодов",
    image: "/products/mindeo-ms3690.png",
    width: 357,
    height: 556,
    device: "scanner",
    word: "считывает.",
    title: "Каждый код важен",
    detail: "Сканирование · Учёт",
    secondTitle: "Удобно в работе",
    secondDetail: "Магазин · Склад",
    icon: ScanLine,
  },
  {
    id: "d82a94e474e86ac1",
    name: "TSC TE200",
    type: "Принтер этикеток",
    image: "/products/tsc-te200.png",
    width: 1000,
    height: 667,
    device: "printer",
    word: "печатает.",
    title: "Порядок в товарах",
    detail: "Этикетки · Штрихкоды",
    secondTitle: "Для ваших задач",
    secondDetail: "Склад · Торговля",
    icon: Printer,
  },
];

export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(preference.matches);
    const syncVisibility = () => setTabVisible(!document.hidden);
    syncMotion();
    syncVisibility();
    preference.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    if (scene.current) observer.observe(scene.current);
    return () => {
      preference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
      observer.disconnect();
    };
  }, []);

  const rotating =
    !paused && !hovered && !reducedMotion && inView && tabVisible;
  useEffect(() => {
    if (!rotating) return;
    const timer = setTimeout(
      () => setActive((index) => (index + 1) % slides.length),
      6500,
    );
    return () => clearTimeout(timer);
  }, [rotating, active]);

  return (
    <div
      ref={scene}
      className="hero-scene"
      role="region"
      aria-roledescription="карусель"
      aria-label="Оборудование ANADO"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (
          !(event.target instanceof HTMLElement) ||
          event.target.dataset.carouselControl !== "playback"
        ) {
          setPaused(true);
        }
      }}
    >
      <div className="scene-grid" />
      <span className="scene-orbit orbit-one" />
      <span className="scene-orbit orbit-two" />
      <div className="scene-pedestal" />
      {slides.map((slide, index) => {
        const selected = active === index;
        return (
          <Fragment key={slide.id}>
            <div
              className={`scene-word hero-scene-word ${selected ? "is-active" : ""}`}
              aria-hidden="true"
            >
              {slide.word}
            </div>
            <div
              className={`hero-product hero-image-slide hero-device-${slide.device} ${selected ? "is-active" : ""}`}
              aria-hidden={!selected}
            >
              <Image
                src={slide.image}
                alt={`${slide.type} ${slide.name} из каталога ANADO`}
                width={slide.width}
                height={slide.height}
                priority={index === 0}
                loading={index === 0 ? undefined : "eager"}
                quality={75}
                sizes="(max-width: 640px) 90vw, 45vw"
                draggable={false}
              />
            </div>
            <div
              className={`hero-slide ${selected ? "is-active" : ""}`}
              role="group"
              aria-roledescription="слайд"
              aria-label={`${index + 1} из ${slides.length}: ${slide.name}`}
              aria-hidden={!selected}
              inert={!selected}
            >
              <div className="float-card float-one">
                <span className="float-icon">
                  <slide.icon size={22} />
                </span>
                <div>
                  <b>{slide.title}</b>
                  <small>{slide.detail}</small>
                </div>
                <span className="green-dot" />
              </div>
              <div className="float-card float-two">
                <span className="float-icon lime">
                  <Layers3 size={21} />
                </span>
                <div>
                  <b>{slide.secondTitle}</b>
                  <small>{slide.secondDetail}</small>
                </div>
              </div>
              <Link href={`/product/${slide.id}`} className="hero-product-link">
                <div>
                  <span>{slide.type}</span>
                  <b>{slide.name}</b>
                </div>
                <ArrowUpRight size={23} />
              </Link>
            </div>
          </Fragment>
        );
      })}
      <div className="scene-index">
        <span className="hero-slide-number" aria-hidden="true">
          {String(active + 1).padStart(2, "0")} <small>/ 03</small>
        </span>
        <div className="hero-pagination" role="group" aria-label="Выбор слайда">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              className={`hero-dot ${active === index ? "is-active" : ""}`}
              aria-label={`Показать ${slide.name}`}
              aria-pressed={active === index}
              onClick={() => {
                setActive(index);
                setPaused(true);
              }}
            >
              <span />
            </button>
          ))}
        </div>
        {!reducedMotion && (
          <button
            className="hero-playback"
            data-carousel-control="playback"
            aria-label={
              paused
                ? "Продолжить смену слайдов"
                : "Приостановить смену слайдов"
            }
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
        )}
        <span>ANADO / BUSINESS TECH</span>
      </div>
    </div>
  );
}
