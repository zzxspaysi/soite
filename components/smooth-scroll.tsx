"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine)");
    let scroll: Lenis | undefined;

    const sync = () => {
      if (desktop.matches && !motion.matches) {
        scroll ??= new Lenis({
          autoRaf: true,
          duration: 0.9,
          smoothWheel: true,
          syncTouch: false,
          allowNestedScroll: true,
          stopInertiaOnNavigate: true,
          prevent: (node) =>
            node.matches("input, select, textarea, [contenteditable='true']"),
        });
      } else {
        scroll?.destroy();
        scroll = undefined;
      }
    };

    sync();
    motion.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    return () => {
      scroll?.destroy();
      motion.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, [pathname]);

  return null;
}
