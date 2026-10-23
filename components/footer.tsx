import Link from "next/link";
import { ArrowUpRight, ArrowUp } from "lucide-react";
export function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-top">
          <div>
            <img
              src="/brand/anado-original.png"
              width="180"
              height="49"
              alt="ANADO"
            />
            <p>
              Оборудование. Программы. Сервис.
              <br />
              Всё, чтобы ваш бизнес работал.
            </p>
          </div>
          <div className="footer-links">
            <Link href="/catalog">Каталог</Link>
            <Link href="/solutions">Автоматизация</Link>
            <Link href="/services">Сервисный центр</Link>
            <Link href="/about">О компании</Link>
            <Link href="/contacts">Контакты</Link>
            <Link href="/delivery">Доставка и оплата</Link>
          </div>
          <div className="footer-contact">
            <a href="tel:+73833495944">
              +7 (383) 349-59-44 <ArrowUpRight size={20} />
            </a>
            <p>
              Новосибирск, ул. Гоголя, 15
              <br />
              Горский микрорайон, 56/1
            </p>
            <Link href="/contacts" className="text-link">
              Связаться с нами <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} ANADO</span>
          <Link href="/privacy">Обработка персональных данных</Link>
          <span>Цены и наличие требуют подтверждения</span>
          <a href="#top" className="back-top" aria-label="Вернуться наверх">
            <ArrowUp size={18} />
          </a>
        </div>
      </div>
    </footer>
  );
}
