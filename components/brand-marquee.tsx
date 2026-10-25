"use client";

import { useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";

const brands = [
  { id: "space", name: "SPACE", sprite: 0 },
  { id: "atol", name: "АТОЛ", src: "/brands/atol.png" },
  { id: "evotor", name: "Эвотор", sprite: 2 },
  { id: "iiko", name: "iiko", sprite: 3 },
  { id: "poscenter", name: "POScenter", sprite: 4 },
  { id: "datamobile", name: "DataMobile", sprite: 5 },
  { id: "cleverence", name: "Клеверенс", sprite: 6 },
  { id: "mertech", name: "MERTECH", sprite: 7 },
  { id: "mindeo", name: "MINDEO", sprite: 8 },
  { id: "tsc", name: "TSC", sprite: 9 },
  { id: "paytor", name: "PAYTOR", src: "/brands/paytor.webp" },
  { id: "shtrih-m", name: "ШТРИХ-М", src: "/brands/shtrih-m.gif" },
  { id: "zebra", name: "Zebra", src: "/brands/zebra.svg" },
];

export function BrandMarquee() {
  const [paused, setPaused] = useState(false);
  return (
    <section className="brand-strip shell" aria-labelledby="brand-heading">
      <div className="brand-panel">
        <p id="brand-heading" className="brand-heading">
          Технологии ведущих производителей
        </p>
        <div className="brand-window">
          <div
            className="brand-track"
            data-paused={paused}
            style={{ "--brand-count": brands.length } as CSSProperties}
          >
            {[false, true].map((duplicate) => (
              <ul
                className="brand-group"
                key={String(duplicate)}
                aria-hidden={duplicate || undefined}
              >
                {brands.map((brand) => (
                  <li className="brand-item" key={brand.id}>
                    {brand.src ? (
                      <img
                        src={brand.src}
                        alt={duplicate ? "" : brand.name}
                        width={160}
                        height={56}
                        draggable={false}
                        decoding="async"
                      />
                    ) : (
                      <span
                        className="brand-logo-sprite"
                        role={duplicate ? undefined : "img"}
                        aria-label={duplicate ? undefined : brand.name}
                        style={
                          {
                            "--brand-column": brand.sprite! % 3,
                            "--brand-row": Math.floor(brand.sprite! / 3),
                          } as CSSProperties
                        }
                      >
                        <img
                          src="/brands/brand-logos.webp"
                          alt=""
                          width={1536}
                          height={1024}
                          draggable={false}
                          decoding="async"
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="brand-playback"
          aria-label={
            paused
              ? "Продолжить движение логотипов"
              : "Приостановить движение логотипов"
          }
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play size={17} /> : <Pause size={17} />}
        </button>
      </div>
    </section>
  );
}
