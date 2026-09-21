"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { GlobeIcon } from "@/components/shell/icons";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  function switchTo(nextLocale: "en" | "ar") {
    if (nextLocale === locale) return;
    router.replace(
      // @ts-expect-error dynamic route params are fine to pass through here
      { pathname, params },
      { locale: nextLocale }
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] p-0.5 text-sm">
      <GlobeIcon className="ms-1.5 text-gray-400" />
      <button
        type="button"
        onClick={() => switchTo("en")}
        aria-pressed={locale === "en"}
        className={`rounded px-2 py-1 font-medium transition-colors ${
          locale === "en" ? "bg-[var(--color-navy)] text-white" : "text-gray-500 hover:bg-gray-100"
        }`}
      >
        {t("english")}
      </button>
      <button
        type="button"
        onClick={() => switchTo("ar")}
        aria-pressed={locale === "ar"}
        className={`rounded px-2 py-1 font-medium transition-colors ${
          locale === "ar" ? "bg-[var(--color-navy)] text-white" : "text-gray-500 hover:bg-gray-100"
        }`}
      >
        {t("arabic")}
      </button>
    </div>
  );
}
