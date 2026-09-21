import { getTranslations } from "next-intl/server";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("settings");
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{t("title")}</h1>
      </div>
      <SettingsTabs />
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
