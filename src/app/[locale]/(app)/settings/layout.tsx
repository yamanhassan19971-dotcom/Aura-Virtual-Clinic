import { getTranslations } from "next-intl/server";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("settings");
  const session = await auth();
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] bg-white px-4 md:px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{t("title")}</h1>
      </div>
      <SettingsTabs
        showStaff={!!session && can(session.user.role, "users.manage")}
        showBackups={!!session && can(session.user.role, "settings.manage")}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
    </div>
  );
}
