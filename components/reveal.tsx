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
    const observed = new WeakSet<Element>();
    const watch = (element: Element) => {
      if (observed.has(element) || element.classList.contains("revealed"))
        return;
      observed.add(element);
      observer.observe(element);
    };
    document.querySelectorAll("[data-reveal]").forEach(watch);

    // Streaming and hydration can insert or replace content after this effect runs.
    const updates = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches("[data-reveal]")) watch(node);
          node.querySelectorAll("[data-reveal]").forEach(watch);
        }
      }
    });
    updates.observe(document.getElementById("main") || document.body, {
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      updates.disconnect();
    };
  }, [pathname]);
  return null;
}
