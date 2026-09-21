import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--color-surface)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar locale={locale} userName={session.user.name} userRole={session.user.role} />
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
