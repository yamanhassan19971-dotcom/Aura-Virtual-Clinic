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
  | "patients.editDemographics"
  | "patients.viewClinical"
  | "patients.manageMedicalHistory"
  | "patients.manageAlerts"
  | "patients.manageClinicalNotes"
  | "patients.manageNoteTemplates"
  | "patients.manageAdminNotes"
  | "patients.manageDocuments"
  | "patients.manageTasks"
  | "patients.manageFamily"
  | "patients.manageFlags"
  | "patients.archive"
  | "settings.manage"
  | "reports.view";

// Server-side role -> permission map. The UI reads this too (to hide
// actions a user can't take), but every mutation is re-checked against this
// map inside the appointment/patient services — the UI check is a
// convenience, not the enforcement boundary.
//
// The Phase 2 principle that matters most here: a Receptionist gets full
// demographic/administrative access but NO clinical access (medical
// history, alerts, clinical notes) — that's reserved for Clinician/Admin.
// Practice Manager can *see* clinical data (oversight) but not author it.
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
    "patients.editDemographics": true,
    "patients.viewClinical": true,
    "patients.manageMedicalHistory": true,
    "patients.manageAlerts": true,
    "patients.manageClinicalNotes": true,
    "patients.manageNoteTemplates": true,
    "patients.manageAdminNotes": true,
    "patients.manageDocuments": true,
    "patients.manageTasks": true,
    "patients.manageFamily": true,
    "patients.manageFlags": true,
    "patients.archive": true,
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
    "patients.editDemographics": true,
    "patients.viewClinical": true,
    "patients.manageMedicalHistory": false,
    "patients.manageAlerts": false,
    "patients.manageClinicalNotes": false,
    "patients.manageNoteTemplates": true,
    "patients.manageAdminNotes": true,
    "patients.manageDocuments": true,
    "patients.manageTasks": true,
    "patients.manageFamily": true,
    "patients.manageFlags": true,
    "patients.archive": true,
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
    "patients.editDemographics": true,
    "patients.viewClinical": false,
    "patients.manageMedicalHistory": false,
    "patients.manageAlerts": false,
    "patients.manageClinicalNotes": false,
    "patients.manageNoteTemplates": false,
    "patients.manageAdminNotes": true,
    "patients.manageDocuments": true,
    "patients.manageTasks": true,
    "patients.manageFamily": true,
    "patients.manageFlags": true,
    "patients.archive": false,
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
    "patients.editDemographics": true,
    "patients.viewClinical": true,
    "patients.manageMedicalHistory": true,
    "patients.manageAlerts": true,
    "patients.manageClinicalNotes": true,
    "patients.manageNoteTemplates": true,
    "patients.manageAdminNotes": true,
    "patients.manageDocuments": true,
    "patients.manageTasks": true,
    "patients.manageFamily": true,
    "patients.manageFlags": true,
    "patients.archive": false,
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
