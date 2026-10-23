"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.classList.add("js-motion");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.08 },
    );
    document
      .querySelectorAll("[data-reveal]")
      .forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
