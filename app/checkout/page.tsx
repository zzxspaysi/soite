import Link from "next/link";
import { Checkout } from "@/components/checkout";
import { paymentMode } from "@/lib/commerce.mjs";
export const metadata = {
  title: "Оформление заказа",
  robots: { index: false, follow: false },
};
import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
export default async function CheckoutPage() {
  if (!(await currentUser())) redirect("/login?next=checkout");
  return (
    <div className="shell">
      <div className="page-heading">
        <div className="breadcrumbs">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/cart">Корзина</Link>
          <span>/</span>
          <span>Оформление</span>
        </div>
        <h1>Оформление заказа</h1>
      </div>
      <Checkout mode={paymentMode()} />
    </div>
  );
}
