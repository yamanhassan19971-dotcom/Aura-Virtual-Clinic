"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import {
  createStaffAction,
  resetStaffPasswordAction,
  setStaffActiveAction,
  updateStaffAction,
} from "@/lib/actions/staff-actions";
import type { ActionResult } from "@/lib/actions/action-result";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  practitioner: { id: string; name: string } | null;
};

type PractitionerLink = { id: string; name: string; userId: string | null };

const ROLES: Role[] = ["ADMIN", "PRACTICE_MANAGER", "RECEPTIONIST", "CLINICIAN"];
const ERROR_CODES = ["EMAIL_TAKEN", "PRACTITIONER_TAKEN", "OWN_ROLE", "OWN_ACTIVE", "LAST_ADMIN"];

const fieldClass = "rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm";
const primaryButton =
  "rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60";
const secondaryButton = "rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-gray-600";

function canTreat(role: Role) {
  return role === "CLINICIAN" || role === "ADMIN";
}

type Dialog =
  | { kind: "add" }
  | { kind: "edit"; user: StaffRow }
  | { kind: "reset"; user: StaffRow }
  | { kind: "deactivate"; user: StaffRow }
  | { kind: "password"; name: string; password: string };

export function StaffTable({
  staff: initial,
  practitioners: initialPractitioners,
  currentUserId,
  now,
}: {
  staff: StaffRow[];
  practitioners: PractitionerLink[];
  currentUserId: string;
  now: Date;
}) {
  const t = useTranslations("staff");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const toast = useToast();
  const [staff, setStaff] = useState(initial);
  const [practitioners, setPractitioners] = useState(initialPractitioners);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);

  function errorMessage(result: Extract<ActionResult<unknown>, { ok: false }>) {
    return result.code && ERROR_CODES.includes(result.code) ? t(`errors.${result.code}`) : result.message;
  }

  function applyUser(user: StaffRow) {
    setStaff((prev) => (prev.some((u) => u.id === user.id) ? prev.map((u) => (u.id === user.id ? user : u)) : [...prev, user]));
    setPractitioners((prev) =>
      prev.map((p) =>
        p.id === user.practitioner?.id ? { ...p, userId: user.id } : p.userId === user.id ? { ...p, userId: null } : p
      )
    );
  }

  async function run<T>(action: () => Promise<ActionResult<T>>, onOk: (data: T) => void) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) onOk(result.data);
    else toast.show(errorMessage(result), { tone: "error" });
  }

  async function toggleActive(user: StaffRow, active: boolean) {
    await run(
      () => setStaffActiveAction({ userId: user.id, active }),
      (updated) => {
        applyUser(updated);
        setDialog(null);
        toast.show(t(active ? "reactivated" : "deactivated"), { tone: "success" });
      }
    );
  }

  function statusBadge(user: StaffRow) {
    if (!user.active) return <Badge tone="gray">{t("inactive")}</Badge>;
    if (user.lockedUntil && new Date(user.lockedUntil) > now) return <Badge tone="red">{t("locked")}</Badge>;
    if (user.mustChangePassword) return <Badge tone="amber">{t("mustChange")}</Badge>;
    return <Badge tone="green">{t("active")}</Badge>;
  }

  return (
    <div className="flex max-w-5xl flex-col gap-3">
      <p className="text-sm text-gray-500">{t("intro")}</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-start">{t("name")}</th>
              <th className="px-4 py-3 text-start">{t("role")}</th>
              <th className="px-4 py-3 text-start">{t("doctor")}</th>
              <th className="px-4 py-3 text-start">{t("lastLogin")}</th>
              <th className="px-4 py-3 text-start">{t("status")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {staff.map((user) => {
              const self = user.id === currentUserId;
              return (
                <tr
                  key={user.id}
                  data-testid={`staff-row-${user.email}`}
                  className={`border-b border-[var(--color-border)] last:border-0 ${user.active ? "" : "text-gray-400"}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">
                      {user.name}
                      {self && <span className="ms-1.5 text-xs font-normal text-gray-400">({t("you")})</span>}
                    </div>
                    <div dir="ltr" className="text-start text-xs text-gray-500">
                      {user.email}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{tRoles(user.role)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{user.practitioner?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {user.lastLoginAt
                      ? format.dateTime(new Date(user.lastLoginAt), { dateStyle: "medium", timeStyle: "short" })
                      : t("never")}
                  </td>
                  <td className="px-4 py-2.5">{statusBadge(user)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5 whitespace-nowrap">
                      <RowButton onClick={() => setDialog({ kind: "edit", user })}>{t("edit")}</RowButton>
                      {user.active && (
                        <RowButton onClick={() => setDialog({ kind: "reset", user })}>{t("resetPassword")}</RowButton>
                      )}
                      {!self &&
                        (user.active ? (
                          <RowButton onClick={() => setDialog({ kind: "deactivate", user })}>{t("deactivate")}</RowButton>
                        ) : (
                          <RowButton disabled={busy} onClick={() => toggleActive(user, true)}>
                            {t("reactivate")}
                          </RowButton>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "add" })}
          className="rounded-md border border-dashed border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-gray-500 hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]"
        >
          + {t("add")}
        </button>
      </div>

      {(dialog?.kind === "add" || dialog?.kind === "edit") && (
        <StaffForm
          user={dialog.kind === "edit" ? dialog.user : null}
          self={dialog.kind === "edit" && dialog.user.id === currentUserId}
          practitioners={practitioners}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={(values) => {
            if (dialog.kind === "edit") {
              const { name, role, practitionerId } = values; // the login itself can't change
              void run(
                () => updateStaffAction({ userId: dialog.user.id, name, role, practitionerId }),
                (updated) => {
                  applyUser(updated);
                  setDialog(null);
                  toast.show(t("updated"), { tone: "success" });
                }
              );
            } else {
              void run(
                () => createStaffAction(values),
                ({ user, temporaryPassword }) => {
                  applyUser(user);
                  setDialog({ kind: "password", name: user.name, password: temporaryPassword });
                }
              );
            }
          }}
        />
      )}

      {dialog?.kind === "reset" && (
        <Modal title={t("resetPassword")} width="sm" onClose={() => setDialog(null)}>
          <p className="text-sm text-gray-600">{t("confirmReset", { name: dialog.user.name })}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={() => setDialog(null)}>
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              className={primaryButton}
              onClick={() =>
                run(
                  () => resetStaffPasswordAction({ userId: dialog.user.id }),
                  ({ temporaryPassword }) => {
                    applyUser({ ...dialog.user, mustChangePassword: true, lockedUntil: null });
                    setDialog({ kind: "password", name: dialog.user.name, password: temporaryPassword });
                  }
                )
              }
            >
              {t("resetPassword")}
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === "deactivate" && (
        <Modal title={t("deactivate")} width="sm" onClose={() => setDialog(null)}>
          <p className="text-sm text-gray-600">{t("confirmDeactivate", { name: dialog.user.name })}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={() => setDialog(null)}>
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-[var(--color-status-fta)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => toggleActive(dialog.user, false)}
            >
              {t("deactivate")}
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === "password" && (
        <PasswordReveal name={dialog.name} password={dialog.password} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function StaffForm({
  user,
  self,
  practitioners,
  busy,
  onClose,
  onSubmit,
}: {
  user: StaffRow | null;
  self: boolean;
  practitioners: PractitionerLink[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; email: string; role: Role; practitionerId: string | null }) => void;
}) {
  const t = useTranslations("staff");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "RECEPTIONIST");
  const [practitionerId, setPractitionerId] = useState(user?.practitioner?.id ?? "");
  const available = practitioners.filter((p) => !p.userId || p.userId === user?.id);

  return (
    <Modal title={user ? t("editTitle", { name: user.name }) : t("addTitle")} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, email, role, practitionerId: canTreat(role) && practitionerId ? practitionerId : null });
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          {t("name")}
          <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          {t("login")}
          <input
            required
            type="email"
            dir="ltr"
            disabled={!!user}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${fieldClass} text-start disabled:bg-gray-50 disabled:text-gray-500`}
          />
          {!user && <span className="font-normal text-gray-500">{t("loginHint")}</span>}
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
          {t("role")}
          <select
            value={role}
            disabled={self}
            onChange={(e) => setRole(e.target.value as Role)}
            className={`${fieldClass} disabled:bg-gray-50`}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </select>
        </label>
        {canTreat(role) && (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            {t("doctor")}
            <select value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} className={fieldClass}>
              <option value="">{t("noDoctor")}</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="font-normal text-gray-500">{t("doctorHint")}</span>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButton} onClick={onClose}>
            {tCommon("cancel")}
          </button>
          <button type="submit" disabled={busy} className={primaryButton}>
            {user ? t("save") : t("create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordReveal({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  const t = useTranslations("staff");
  const [copied, setCopied] = useState(false);
  return (
    <Modal title={t("passwordTitle", { name })} width="sm" onClose={onClose}>
      <p className="text-sm text-gray-600">{t("passwordNote", { name })}</p>
      <div className="mt-4 flex items-center gap-2">
        <code
          dir="ltr"
          data-testid="one-time-password"
          className="flex-1 select-all rounded-md border border-[var(--color-border)] bg-gray-50 px-3 py-2 text-center font-mono text-lg tracking-wider"
        >
          {password}
        </code>
        <button
          type="button"
          className={secondaryButton}
          onClick={() =>
            navigator.clipboard
              ?.writeText(password)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" className={primaryButton} onClick={onClose}>
          {t("done")}
        </button>
      </div>
    </Modal>
  );
}

function RowButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Badge({ tone, children }: { tone: "green" | "amber" | "red" | "gray"; children: React.ReactNode }) {
  const tones = {
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-100 text-gray-500",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
