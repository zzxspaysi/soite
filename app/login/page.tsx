import { AuthForm } from "@/components/auth-form";
export const metadata = {
  title: "Вход",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <div className="shell account-page">
      <h1>Вход</h1>
      <AuthForm register={false} next={(await searchParams).next} />
    </div>
  );
}
