"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { MenuIcon } from "@/components/shell/icons";

// Below the lg breakpoint (phones, iPad portrait) the sidebar is a drawer
// opened from the top bar, so the page gets the full screen width.
const NavDrawerContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function NavDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return <NavDrawerContext.Provider value={{ open, setOpen }}>{children}</NavDrawerContext.Provider>;
}

export function useNavDrawer() {
  return useContext(NavDrawerContext);
}

export function MenuButton() {
  const t = useTranslations("nav");
  const { open, setOpen } = useNavDrawer();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={t("menu")}
      aria-expanded={open}
      className="-ms-2 rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
    >
      <MenuIcon width={22} height={22} />
    </button>
  );
}
