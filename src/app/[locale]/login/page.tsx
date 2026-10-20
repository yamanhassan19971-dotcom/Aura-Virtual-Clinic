import { LoginForm } from "@/components/login/LoginForm";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; ended?: string }>;
}) {
  const { locale } = await params;
  const { callbackUrl, ended } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-navy)] px-4">
      <LoginForm
        locale={locale}
        callbackUrl={callbackUrl}
        ended={ended === "1"}
        // The clinic's own install has real accounts; the demo hint is for the seeded demo only.
        showDemoHint={process.env.NODE_ENV !== "production"}
      />
    </div>
  );
}
