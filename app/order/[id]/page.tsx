import { OrderResult } from "@/components/order-result";
export const metadata = {
  title: "Статус заказа",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="shell">
      <OrderResult id={(await params).id} />
    </div>
  );
}
