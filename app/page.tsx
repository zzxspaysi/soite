import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Barcode,
  Layers3,
  MonitorCog,
  ShieldCheck,
  Store,
  Warehouse,
  UtensilsCrossed,
  Factory,
  Headphones,
  Plus,
} from "lucide-react";
import { categories, featured, categoryVisuals } from "@/lib/catalog.mjs";
import { ProductCard } from "@/components/product-card";
import { HeroCarousel } from "@/components/hero-carousel";
import { paymentMode } from "@/lib/commerce.mjs";
import type { Product, Category } from "@/lib/types";
const shortNames: Record<string, string> = {
  "online-kassy": "Онлайн-кассы",
  category_369: "Распродажа",
  printland: "Принтеры",
  ident: "Сканеры и ТСД",
  uslugi: "Услуги",
  pos_sistems: "POS-системы",
  pos_oborud: "POS-оборудование",
  pos_perifer: "POS-периферия",
  vesovoe_oborud: "Весовое оборудование",
  bank_oborud: "Банковское оборудование",
  equaring: "Платёжные решения",
  markirov: "Маркировка",
  rashodniki: "Расходные материалы",
  protivkrajy: "Противокражные системы",
  category_104: "Программные продукты",
  category_103: "Упаковочное оборудование",
  zip: "Запчасти",
  battery: "Аккумуляторы",
  "other-devices": "Другое оборудование",
};
export default function Home() {
  const roots = (categories() as unknown as Category[]).filter(
      (c) => !c.parent,
    ),
    products = featured() as unknown as Product[],
    visuals = categoryVisuals();
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> Автоматизация бизнеса с ANADO
          </div>
          <h1>
            Ваш бизнес.
            <br />
            Новый <span>уровень.</span>
          </h1>
          <p>
            Оборудование, программы и сервис,
            <br className="desktop-only" /> которые работают вместе. От первой
            кассы
            <br className="desktop-only" /> до автоматизации всего предприятия.
          </p>
          <div className="hero-buttons">
            <Link href="/catalog" className="btn btn-blue">
              Выбрать оборудование <ArrowUpRight size={20} />
            </Link>
            <Link href="/solutions" className="btn btn-outline">
              Найти решение <ArrowRight size={19} />
            </Link>
          </div>
          <div className="hero-proof">
            <div className="mini-brand">
              <Check size={17} />
            </div>
            <span>Подбираем. Настраиваем. Поддерживаем.</span>
          </div>
        </div>
        <HeroCarousel />
      </section>
      <div className="brand-strip shell">
        <span>Технологии ведущих производителей</span>
        <div>
          <b>АТОЛ</b>
          <b className="evotor-word">эвотор</b>
          <b>MERTECH</b>
          <b className="mindeo-word">mindeo</b>
          <b>ШТРИХ-М</b>
          <b>ZEBRA</b>
        </div>
      </div>
      <section className="section catalog-home" id="catalog">
        <div className="shell">
          <div className="section-heading" data-reveal>
            <div>
              <div className="eyebrow">01 / Каталог оборудования</div>
              <h2>
                Всё для работы.
                <br />
                <span className="muted">В одном месте.</span>
              </h2>
            </div>
            <Link href="/catalog" className="text-link">
              Весь каталог <ArrowUpRight size={21} />
            </Link>
          </div>
          <div className="home-categories">
            {roots.map((c, i) => (
              <Link
                href={`/catalog?category=${c.id}`}
                key={c.id}
                className={`category-tile ${i === 0 ? "category-featured" : ""}`}
                data-reveal
              >
                <div className="category-top">
                  <span className="category-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <ArrowUpRight size={21} />
                </div>
                <h3>{shortNames[c.id] || c.name}</h3>
                <div className="category-media">
                  <span className="category-count">{c.count} товаров</span>
                  {c.id !== "uslugi" && visuals[c.id] ? (
                    <img src={visuals[c.id]} alt="" loading="lazy" />
                  ) : (
                    <span className="category-line-art">
                      {c.id === "uslugi" ? (
                        <Headphones />
                      ) : i % 3 === 0 ? (
                        <MonitorCog />
                      ) : i % 3 === 1 ? (
                        <Layers3 />
                      ) : (
                        <Barcode />
                      )}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section solutions-section">
        <div className="shell">
          <div className="section-heading" data-reveal>
            <div>
              <div className="eyebrow">02 / Решения для бизнеса</div>
              <h2>
                Знаем задачи.
                <br />
                Находим решения.
              </h2>
            </div>
            <p className="heading-note">
              Соединяем оборудование и программы
              <br />в систему, удобную именно вам.
            </p>
          </div>
          <div className="solutions-grid">
            {[
              {
                name: "Магазины и розница",
                text: "От кассовой зоны до товарного учёта",
                icon: Store,
              },
              {
                name: "Склады и логистика",
                text: "Точный учёт. Быстрая обработка.",
                icon: Warehouse,
              },
              {
                name: "Кафе и рестораны",
                text: "Больше внимания вашим гостям",
                icon: UtensilsCrossed,
              },
              {
                name: "Производство",
                text: "Контроль на каждом этапе",
                icon: Factory,
              },
            ].map((x, i) => (
              <Link
                href={`/solutions#solution-${i}`}
                key={x.name}
                className="solution-card"
                data-reveal
              >
                <x.icon size={34} strokeWidth={1.3} />
                <span className="solution-index">0{i + 1}</span>
                <h3>{x.name}</h3>
                <p>{x.text}</p>
                <span className="circle-arrow">
                  <ArrowUpRight size={21} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section shell">
        <div className="section-heading" data-reveal>
          <div>
            <div className="eyebrow">03 / Выбор оборудования</div>
            <h2>Начните с главного</h2>
          </div>
          <Link href="/catalog?category=online-kassy" className="text-link">
            Все онлайн-кассы <ArrowUpRight size={21} />
          </Link>
        </div>
        <div className="product-grid featured-products">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <p className="price-disclaimer">
          Цены из каталога ANADO. Актуальную стоимость и наличие подтвердим при
          оформлении.
        </p>
      </section>
      <section className="service-section">
        <div className="shell service-inner">
          <div data-reveal>
            <div className="eyebrow">04 / Поддержка рядом</div>
            <h2>
              Техника работает.
              <br />
              <span>Вы развиваете бизнес.</span>
            </h2>
            <p>
              Поможем с регистрацией кассы, подключением оборудования и
              программ. А если что-то пойдёт не так — наш сервисный центр рядом.
            </p>
            <Link href="/services" className="btn btn-lime">
              Сервис и услуги <ArrowUpRight size={20} />
            </Link>
          </div>
          <div className="service-steps" data-reveal>
            {[
              {
                icon: MonitorCog,
                title: "Подключим и настроим",
                text: "Оборудование, кассовое ПО и товарный учёт",
              },
              {
                icon: ShieldCheck,
                title: "Возьмём на обслуживание",
                text: "Диагностика, ремонт и обновления",
              },
              {
                icon: Headphones,
                title: "Поможем разобраться",
                text: "Консультации и обучение сотрудников",
              },
            ].map((x, i) => (
              <div key={x.title}>
                <x.icon size={28} strokeWidth={1.4} />
                <span>
                  <b>{x.title}</b>
                  <small>{x.text}</small>
                </span>
                <span className="step-number">0{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section shell faq-section">
        <div data-reveal>
          <div className="eyebrow">Полезно знать</div>
          <h2>
            Ответы
            <br />
            на ваши вопросы
          </h2>
          <Link className="text-link" href="/contacts">
            Задать свой вопрос <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="faq-list" data-reveal>
          {[
            [
              "Поможете подобрать оборудование?",
              "Да. Расскажите о вашем бизнесе: формат торговли, количество рабочих мест и используемые программы. Подберём совместимые устройства и необходимые услуги.",
            ],
            [
              "Можно ли связать магазин с 1С:УТ?",
              "Да, для нового магазина предусмотрен обмен ценами, остатками и заказами с 1С:Управление торговлей. Подключение зависит от версии и настроек вашей базы и выполняется отдельно.",
            ],
            [
              "Как оплатить заказ?",
              paymentMode() === "demo"
                ? "Предусмотрены карты и СБП через ЮKassa, а также оплата по счёту. Сейчас работает демонстрационный сценарий без списания денег."
                : "Оплатите заказ картой или через СБП на защищённой странице ЮKassa. Для оплаты по счёту выберите соответствующий способ при оформлении. Позиции с ценой по запросу сначала согласуем с менеджером.",
            ],
            [
              "Что с доставкой и самовывозом?",
              "Самовывоз — из офисов в Новосибирске. Доставку и её стоимость согласуем с менеджером отдельно перед оплатой.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <Plus size={20} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
