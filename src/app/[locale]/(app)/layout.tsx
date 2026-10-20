import { redirect as redirectTo } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { auth, cookieSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { countFollowUpsDue } from "@/lib/services/pipeline-queries";
import { NavDrawerProvider } from "@/components/shell/NavDrawer";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { BackupBanner } from "@/components/shell/BackupBanner";
import { ToastProvider } from "@/components/ui/Toast";
import { FirstPasswordScreen } from "@/components/account/FirstPasswordScreen";

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
    if (await cookieSession()) redirectTo(`/api/session-ended?locale=${locale}`);
    redirect({ href: "/login", locale });
    return null;
  }

  // A one-time password (new account or reset) opens nothing until the person
  // has chosen their own.
  if (session.user.mustChangePassword) {
    return (
      <ToastProvider>
        <FirstPasswordScreen locale={locale} userName={session.user.name} />
      </ToastProvider>
    );
  }

  const followUpsDue = can(session.user.role, "followUps.view") ? await countFollowUpsDue(session.user.practiceId) : 0;

  return (
    <ToastProvider>
      <NavDrawerProvider>
      <div className="flex h-dvh overflow-hidden bg-[var(--color-surface)]">
        <Sidebar
          followUpsDue={followUpsDue}
          hidden={[
            ...(can(session.user.role, "leads.view") ? [] : ["/leads"]),
            ...(can(session.user.role, "reports.view") ? [] : ["/reports"]),
          ]}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar locale={locale} userName={session.user.name} userRole={session.user.role} />
          {can(session.user.role, "settings.manage") && <BackupBanner />}
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      </NavDrawerProvider>
    </ToastProvider>
  );
}
