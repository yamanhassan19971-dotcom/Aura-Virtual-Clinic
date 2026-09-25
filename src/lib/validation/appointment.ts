import { z } from "zod";

export const CANCELLATION_REASONS = [
  "PATIENT_CANCELLED",
  "CLINIC_CANCELLED",
  "RESCHEDULED",
  "OTHER",
] as const;

export const FTA_REASONS = [
  "DID_NOT_ATTEND",
  "NO_RESPONSE",
  "FORGOT_APPOINTMENT",
  "OTHER",
] as const;

export const MANUAL_STATUSES = ["PENDING", "CONFIRMED", "ARRIVED", "IN_SURGERY", "COMPLETED"] as const;

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  practitionerId: z.string().min(1),
  roomId: z.string().min(1),
  appointmentTypeId: z.string().min(1),
  startTime: z.coerce.date(),
  durationMin: z.number().int().min(5).max(480),
  status: z.enum(["PENDING", "CONFIRMED"]).default("PENDING"),
  notes: z.string().max(2000).optional().nullable(),
  overrideConflict: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1).optional(),
  practitionerId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  appointmentTypeId: z.string().min(1).optional(),
  startTime: z.coerce.date().optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
  notes: z.string().max(2000).optional().nullable(),
  overrideConflict: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
});
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const changeStatusSchema = z.object({
  appointmentId: z.string().min(1),
  status: z.enum(MANUAL_STATUSES),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export const cancelAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.enum(CANCELLATION_REASONS),
  notes: z.string().max(1000).optional().nullable(),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const ftaAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.enum(FTA_REASONS),
  notes: z.string().max(1000).optional().nullable(),
});
export type FtaAppointmentInput = z.infer<typeof ftaAppointmentSchema>;

// newPatientSchema moved to @/lib/validation/patient (Phase 2 grew a full
// patient-details schema there too; keeping all patient validation in one
// file).
