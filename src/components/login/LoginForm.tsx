"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction } from "@/lib/actions/auth-actions";

export function LoginForm({ locale, callbackUrl }: { locale: string; callbackUrl?: string }) {
  const t = useTranslations("login");
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <div className="mb-2 text-lg font-semibold tracking-tight text-[var(--color-navy)]">
          AURA
        </div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? `/${locale}/appointments`} />

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("email")}
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-blue)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("password")}
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-blue)]"
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-[var(--color-status-fta)]">
            {t("invalidCredentials")}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-navy-light)] disabled:opacity-60"
        >
          {t("submit")}
        </button>
      </form>

      <p className="mt-6 text-center text-xs leading-relaxed text-gray-400">{t("demoHint")}</p>
    </div>
  );
}
