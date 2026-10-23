import Link from "next/link";
import { Cart } from "@/components/cart";
import { paymentMode } from "@/lib/commerce.mjs";
export const metadata = { title: "Корзина" };
export default function CartPage() {
  return (
    <div className="shell">
      <div className="page-heading">
        <div className="breadcrumbs">
          <Link href="/">Главная</Link>
          <span>/</span>
          <span>Корзина</span>
        </div>
        <h1>Корзина</h1>
      </div>
      <Cart mode={paymentMode()} />
    </div>
  );
}
