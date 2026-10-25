import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/golos-text";
import "lenis/dist/lenis.css";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StoreProvider } from "@/components/store-provider";
import { Reveal } from "@/components/reveal";
import { SmoothScroll } from "@/components/smooth-scroll";
import { categories } from "@/lib/catalog.mjs";
import type { Category } from "@/lib/types";
export const metadata: Metadata = {
  title: {
    default: "ANADO — технологии вашего бизнеса",
    template: "%s — ANADO",
  },
  description:
    "Оборудование, программы и сервис для автоматизации торговли, склада и производства. Онлайн-кассы, сканеры, принтеры, POS-системы. Новосибирск.",
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body id="top">
        <a className="skip-link" href="#main">
          Перейти к содержимому
        </a>
        <StoreProvider>
          <Header categories={categories() as unknown as Category[]} />
          <main id="main">{children}</main>
          <Footer />
          <Reveal />
          <SmoothScroll />
        </StoreProvider>
      </body>
    </html>
  );
}
