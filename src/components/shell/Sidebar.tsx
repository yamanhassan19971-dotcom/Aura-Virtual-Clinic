"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useNavDrawer } from "@/components/shell/NavDrawer";
import {
  CalendarIcon,
  CloseIcon,
  ClinicalIcon,
  DashboardIcon,
  FollowUpIcon,
  LeadsIcon,
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
  badge?: "followUps";
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: DashboardIcon },
  { href: "/appointments", labelKey: "appointments", icon: CalendarIcon, primary: true },
  { href: "/leads", labelKey: "leads", icon: LeadsIcon },
  { href: "/follow-ups", labelKey: "followUps", icon: FollowUpIcon, badge: "followUps" },
  { href: "/patients", labelKey: "patients", icon: PatientsIcon },
  { href: "/treatment-plans", labelKey: "treatmentPlans", icon: TreatmentIcon },
  { href: "/clinical", labelKey: "clinical", icon: ClinicalIcon },
  { href: "/reports", labelKey: "reports", icon: ReportsIcon },
  { href: "/settings", labelKey: "settings", icon: SettingsIcon },
];

export function Sidebar({ followUpsDue = 0, hidden = [] }: { followUpsDue?: number; hidden?: string[] }) {
  const t = useTranslations("nav");
  const { open, setOpen } = useNavDrawer();

  return (
    <>
      <aside className="hidden h-full w-60 shrink-0 flex-col border-e border-[var(--color-border)] bg-[var(--color-navy)] text-white lg:flex">
        <SidebarContent followUpsDue={followUpsDue} hidden={hidden} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("menu")}>
          <button
            type="button"
            aria-label={t("closeMenu")}
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-[var(--color-navy)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("closeMenu")}
              className="absolute end-3 top-4 rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <CloseIcon />
            </button>
            <SidebarContent followUpsDue={followUpsDue} hidden={hidden} />
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarContent({ followUpsDue, hidden }: { followUpsDue: number; hidden: string[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-16 items-center gap-2 px-5">
        <span className="text-lg font-semibold tracking-tight">AURA</span>
        <span className="text-xs text-white/50">Dental PMS</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.filter((item) => !hidden.includes(item.href)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors lg:py-2 ${
                active
                  ? "bg-white text-[var(--color-navy)]"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="shrink-0" />
              <span className="flex-1">{t(item.labelKey)}</span>
              {item.badge === "followUps" && followUpsDue > 0 && (
                <span
                  className={`rounded-full px-1.5 text-xs font-semibold ${
                    active ? "bg-[var(--color-navy)] text-white" : "bg-rose-500 text-white"
                  }`}
                >
                  {followUpsDue}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-white/40">
        {t("location")}: {t("locationName")}
      </div>
    </>
  );
}
