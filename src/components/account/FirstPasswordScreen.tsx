import { getTranslations } from "next-intl/server";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { signOutAction } from "@/lib/actions/sign-out-action";

export async function FirstPasswordScreen({ locale, userName }: { locale: string; userName: string }) {
  const t = await getTranslations("account");
  const tCommon = await getTranslations("common");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-navy)] px-4 py-8">
      <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-1 text-lg font-semibold tracking-tight text-[var(--color-navy)]">AURA</div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{t("firstTitle")}</h1>
        <p className="mb-5 mt-1 text-sm text-gray-500">
          {userName} · {t("firstIntro")}
        </p>
        <ChangePasswordForm firstTime />
        <form
          className="mt-4 border-t border-[var(--color-border)] pt-4"
          action={async () => {
            "use server";
            await signOutAction(locale);
          }}
        >
          <button type="submit" className="text-sm text-gray-500 underline hover:text-gray-700">
            {tCommon("signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
