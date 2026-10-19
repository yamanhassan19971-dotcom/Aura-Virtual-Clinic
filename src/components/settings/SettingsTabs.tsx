"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  { href: "/settings/clinicians", key: "clinicians" },
  { href: "/settings/appointment-types", key: "appointmentTypes" },
  { href: "/settings/working-hours", key: "workingHours" },
  { href: "/settings/price-list", key: "priceList" },
];

export function SettingsTabs() {
  const t = useTranslations("settings");
  const pathname = usePathname();

  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto whitespace-nowrap border-b border-[var(--color-border)] bg-white px-4 md:px-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-3 py-3 text-sm font-medium ${
              active
                ? "border-[var(--color-blue)] text-[var(--color-blue)]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}
