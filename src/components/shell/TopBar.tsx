import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
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
    <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-white px-6">
      <div className="text-sm text-gray-500">
        <span className="font-medium text-[var(--color-text)]">{userName}</span>
        <span className="mx-2 text-gray-300">•</span>
        <RoleLabel role={userRole} />
      </div>
      <div className="flex items-center gap-3">
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
  const labels: Record<string, string> = {
    ADMIN: "Admin",
    PRACTICE_MANAGER: "Practice Manager",
    RECEPTIONIST: "Receptionist",
    CLINICIAN: "Clinician",
  };
  return <span>{labels[role] ?? role}</span>;
}

function SignOutButton() {
  const t = useTranslations("common");
  return (
    <button
      type="submit"
      className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
    >
      {t("signOut")}
    </button>
  );
}
