"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  CalendarIcon,
  ClinicalIcon,
  DashboardIcon,
  PatientsIcon,
  ReportsIcon,
  SettingsIcon,
  TreatmentIcon,
} from "@/components/shell/icons";
import type { ComponentType, SVGProps } from "react";

type NavItem = {
  href: string;
  labelKey: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  primary?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: DashboardIcon },
  { href: "/appointments", labelKey: "appointments", icon: CalendarIcon, primary: true },
  { href: "/patients", labelKey: "patients", icon: PatientsIcon },
  { href: "/treatment-plans", labelKey: "treatmentPlans", icon: TreatmentIcon },
  { href: "/clinical", labelKey: "clinical", icon: ClinicalIcon },
  { href: "/reports", labelKey: "reports", icon: ReportsIcon },
  { href: "/settings", labelKey: "settings", icon: SettingsIcon },
];

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-e border-[var(--color-border)] bg-[var(--color-navy)] text-white">
      <div className="flex h-16 items-center gap-2 px-5">
        <span className="text-lg font-semibold tracking-tight">AURA</span>
        <span className="text-xs text-white/50">Dental PMS</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-[var(--color-navy)]"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="shrink-0" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-white/40">
        {t("location")}: Damascus Main Clinic
      </div>
    </aside>
  );
}
