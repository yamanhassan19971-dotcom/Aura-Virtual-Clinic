import { useTranslations } from "next-intl";

export function Placeholder({ label }: { label: string }) {
  const t = useTranslations("placeholder");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="text-sm font-medium uppercase tracking-wide text-[var(--color-blue)]">
        {label}
      </div>
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">{t("title")}</h1>
      <p className="max-w-md text-sm text-gray-500">{t("body")}</p>
    </div>
  );
}
