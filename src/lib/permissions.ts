import type { Role } from "@prisma/client";

export type Permission =
  | "appointments.create"
  | "appointments.edit"
  | "appointments.move"
  | "appointments.statusChange"
  | "appointments.cancel"
  | "appointments.fta"
  | "appointments.overrideConflict"
  | "patients.create"
  | "patients.view"
  | "settings.manage"
  | "reports.view";

// Server-side role -> permission map. The UI reads this too (to hide
// actions a user can't take), but every mutation is re-checked against this
// map inside the appointment service — the UI check is a convenience, not
// the enforcement boundary.
const ROLE_PERMISSIONS: Record<Role, Record<Permission, boolean>> = {
  ADMIN: {
    "appointments.create": true,
    "appointments.edit": true,
    "appointments.move": true,
    "appointments.statusChange": true,
    "appointments.cancel": true,
    "appointments.fta": true,
    "appointments.overrideConflict": true,
    "patients.create": true,
    "patients.view": true,
    "settings.manage": true,
    "reports.view": true,
  },
  PRACTICE_MANAGER: {
    "appointments.create": true,
    "appointments.edit": true,
    "appointments.move": true,
    "appointments.statusChange": true,
    "appointments.cancel": true,
    "appointments.fta": true,
    "appointments.overrideConflict": true,
    "patients.create": true,
    "patients.view": true,
    "settings.manage": true,
    "reports.view": true,
  },
  RECEPTIONIST: {
    "appointments.create": true,
    "appointments.edit": true,
    "appointments.move": true,
    "appointments.statusChange": true,
    "appointments.cancel": true,
    "appointments.fta": true,
    "appointments.overrideConflict": false,
    "patients.create": true,
    "patients.view": true,
    "settings.manage": false,
    "reports.view": false,
  },
  CLINICIAN: {
    "appointments.create": false,
    "appointments.edit": false,
    "appointments.move": false,
    "appointments.statusChange": true,
    "appointments.cancel": true,
    "appointments.fta": true,
    "appointments.overrideConflict": false,
    "patients.create": false,
    "patients.view": true,
    "settings.manage": false,
    "reports.view": false,
  },
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Not permitted: ${permission}`);
    this.name = "PermissionError";
  }
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new PermissionError(permission);
  }
}
