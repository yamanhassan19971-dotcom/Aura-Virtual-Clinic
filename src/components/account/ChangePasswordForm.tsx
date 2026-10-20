"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { changeOwnPasswordAction } from "@/lib/actions/staff-actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/staff";

const inputClass =
  "rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--color-blue)]";

/**
 * Changes the signed-in person's own password. `firstTime` is the screen shown
 * after signing in with a one-time password: the current field is labelled as
 * that password, and the app opens once a new one is saved.
 */
export function ChangePasswordForm({ firstTime = false }: { firstTime?: boolean }) {
  const t = useTranslations("account");
  const tStaff = useTranslations("staff");
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    if (newPassword.length < MIN_PASSWORD_LENGTH) return setError(t("tooShort", { min: MIN_PASSWORD_LENGTH }));
    if (newPassword !== confirmPassword) return setError(t("mismatch"));
    setSubmitting(true);
    const result = await changeOwnPasswordAction({ currentPassword, newPassword, confirmPassword });
    setSubmitting(false);
    if (!result.ok) {
      const known = result.code === "WRONG_PASSWORD" || result.code === "SAME_PASSWORD";
      return setError(known ? tStaff(`errors.${result.code}`) : result.message);
    }
    setError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {firstTime ? t("firstCurrent") : t("currentPassword")}
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("newPassword")}
          <input
            type="password"
            required
            autoComplete="new-password"
            aria-describedby="new-password-rule"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <span id="new-password-rule" className="text-xs text-gray-500">
          {t("rule", { min: MIN_PASSWORD_LENGTH })}
        </span>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {t("confirmPassword")}
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-[var(--color-status-fta)]">
          {error}
        </p>
      )}
      {done && !firstTime && (
        <p role="status" className="text-sm text-green-700">
          {t("changed")}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-navy-light)] disabled:opacity-60"
      >
        {firstTime ? t("continue") : t("changePassword")}
      </button>
    </form>
  );
}
