import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { MenuButton } from "@/components/shell/NavDrawer";
import { SignOutIcon } from "@/components/shell/icons";
import { signOutAction } from "@/lib/actions/sign-out-action";

export function TopBar({
  locale,
  userName,
  userRole,
}: {
  locale: string;
  userName: string;
  userRole: string;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] bg-white px-4 pt-[env(safe-area-inset-top)] lg:h-16 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 text-sm text-gray-500">
        <MenuButton />
        <Link
          href="/account"
          className="truncate font-medium text-[var(--color-text)] hover:text-[var(--color-blue)] hover:underline"
        >
          {userName}
        </Link>
        <span className="hidden text-gray-300 sm:inline">•</span>
        <span className="hidden sm:inline">
          <RoleLabel role={userRole} />
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        <LanguageSwitcher />
        <form
          action={async () => {
            "use server";
            await signOutAction(locale);
          }}
        >
          <SignOutButton />
        </form>
      </div>
    </header>
  );
}

function RoleLabel({ role }: { role: string }) {
  const t = useTranslations("roles");
  return <span>{t.has(role) ? t(role) : role}</span>;
}

function SignOutButton() {
  const t = useTranslations("common");
  return (
    <button
      type="submit"
      aria-label={t("signOut")}
      className="rounded-md border border-[var(--color-border)] p-2 text-sm font-medium text-gray-600 hover:bg-gray-50 sm:px-3 sm:py-1.5"
    >
      <SignOutIcon className="sm:hidden" />
      <span className="hidden sm:inline">{t("signOut")}</span>
    </button>
  );
}
