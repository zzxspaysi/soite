import { AuthForm } from "@/components/auth-form";
export const metadata = {
  title: "Регистрация",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <div className="shell account-page">
      <h1>Регистрация</h1>
      <AuthForm register={true} next={(await searchParams).next} />
    </div>
  );
}
