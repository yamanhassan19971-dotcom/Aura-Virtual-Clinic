import { LoginForm } from "@/components/login/LoginForm";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { locale } = await params;
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-navy)] px-4">
      <LoginForm locale={locale} callbackUrl={callbackUrl} />
    </div>
  );
}
