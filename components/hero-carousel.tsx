"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";

import { homeNews as slides } from "@/lib/home-news";
const count = slides.length;
const AUTOPLAY_INTERVAL_MS = 6666;
const banners = [slides[count - 1], ...slides, slides[0]];
const normalize = (position: number) => ((position - 1 + count) % count) + 1;

export function HeroCarousel() {
  // The first and last banners are visual copies for seamless wraparound.
  const [position, setPosition] = useState(1);
  const [animated, setAnimated] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const carousel = useRef<HTMLDivElement>(null);
  const moving = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const active = normalize(position) - 1;

  const finishTransition = useCallback(() => {
    moving.current = false;
    setAnimated(false);
    setPosition((current) => normalize(current));
  }, []);
  const show = useCallback(
    (next: number, manual = true) => {
      if (moving.current) return;
      if (manual) setPaused(true);
      if (reducedMotion) {
        setPosition(normalize(next));
        return;
      }
      moving.current = true;
      setAnimated(true);
      setPosition(next);
    },
    [reducedMotion],
  );

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
    if (carousel.current) observer.observe(carousel.current);
    return () => {
      preference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!animated) return;
    if (reducedMotion) {
      finishTransition();
      return;
    }
    // Finish even if a background tab or interrupted CSS transition skips its event.
    const timer = setTimeout(finishTransition, 1400);
    return () => clearTimeout(timer);
  }, [position, animated, reducedMotion, finishTransition]);

  const rotating =
    !paused && !hovered && !reducedMotion && inView && tabVisible;
  useEffect(() => {
    if (!rotating) return;
    // Count from the start of a slide change, including its transition time.
    // The visual clone reset must not restart this interval at the loop boundary.
    const timer = setTimeout(
      () => show(active + 2, false),
      AUTOPLAY_INTERVAL_MS,
    );
    return () => clearTimeout(timer);
  }, [rotating, active, show]);

  return (
    <div
      ref={carousel}
      className="promo-carousel"
      role="region"
      aria-roledescription="карусель"
      aria-label="Новости ANADO"
      tabIndex={0}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (
          !(event.target instanceof HTMLElement) ||
          event.target.dataset.carouselControl !== "playback"
        )
          setPaused(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          show(position + (event.key === "ArrowRight" ? 1 : -1));
        }
      }}
    >
      <div
        className="promo-stage"
        onTouchStart={(event) => {
          const point = event.touches[0];
          touch.current =
            event.touches.length === 1
              ? { x: point.clientX, y: point.clientY }
              : null;
        }}
        onTouchEnd={(event) => {
          const point = event.changedTouches[0],
            start = touch.current;
          touch.current = null;
          if (!start || !point) return;
          const dx = point.clientX - start.x,
            dy = point.clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3)
            show(position + (dx < 0 ? 1 : -1));
        }}
        onTouchCancel={() => {
          touch.current = null;
        }}
      >
        <div
          className={`promo-track ${animated ? "is-moving" : ""}`}
          style={{
            transform: `translateX(calc(-50% - ${position} * (var(--banner-width) + var(--banner-gap))))`,
          }}
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === "transform"
            )
              finishTransition();
          }}
        >
          {banners.map((slide, index) => {
            const selected = position === index;
            return (
              <article
                key={`${index}-${slide.id}`}
                className={`promo-slide promo-theme-${slide.theme} promo-device-${slide.device} ${selected ? "is-active" : ""}`}
                role="group"
                aria-roledescription="слайд"
                aria-label={`${normalize(index)} из ${count}: ${slide.name}`}
                aria-hidden={!selected}
                inert={!selected}
              >
                <div className="promo-copy">
                  <span className="promo-category">{slide.category}</span>
                  <h2 aria-label={slide.name}>
                    {slide.lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h2>
                  <p>{slide.description}</p>
                  <Link
                    href="/catalog"
                    className="promo-cta"
                    prefetch={selected}
                  >
                    В каталог <ArrowUpRight size={21} />
                  </Link>
                </div>
                <div className="promo-device">
                  <Image
                    src={slide.image}
                    alt={slide.name}
                    width={slide.width}
                    height={slide.height}
                    preload={index === 1}
                    loading={index === 1 ? undefined : "eager"}
                    sizes="(max-width: 760px) 85vw, (max-width: 1900px) 44vw, 820px"
                    quality={75}
                    draggable={false}
                  />
                </div>
                <div className="promo-signature" aria-hidden="true">
                  <b>ANADO</b>
                  <span>Технологии вашего бизнеса</span>
                </div>
              </article>
            );
          })}
        </div>
        <button
          className="promo-arrow promo-prev"
          aria-label="Предыдущий слайд"
          onClick={() => show(position - 1)}
        >
          <ChevronLeft size={26} />
        </button>
        <button
          className="promo-arrow promo-next"
          aria-label="Следующий слайд"
          onClick={() => show(position + 1)}
        >
          <ChevronRight size={26} />
        </button>
      </div>
      <div className="promo-controls">
        <span className="promo-counter" aria-hidden="true">
          {String(active + 1).padStart(2, "0")}
          <span> / {String(count).padStart(2, "0")}</span>
        </span>
        <div
          className="promo-pagination"
          role="group"
          aria-label="Выбор слайда"
        >
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              className={`promo-dot ${active === index ? "is-active" : ""}`}
              aria-label={`Показать ${slide.name}`}
              aria-pressed={active === index}
              onClick={() => show(index + 1)}
            >
              <span />
            </button>
          ))}
        </div>
        {!reducedMotion && (
          <button
            className="promo-playback"
            data-carousel-control="playback"
            aria-label={
              paused
                ? "Продолжить смену слайдов"
                : "Приостановить смену слайдов"
            }
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        )}
      </div>
      <p
        className="sr-only"
        role="status"
        aria-live={paused || reducedMotion ? "polite" : "off"}
        aria-atomic="true"
      >
        {active + 1} из {count}: {slides[active].name}
      </p>
    </div>
  );
}
