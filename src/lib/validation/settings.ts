import { z } from "zod";

export const createPractitionerSchema = z.object({
  name: z.string().min(1).max(150),
  title: z.string().min(1).max(80),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  defaultRoomId: z.string().min(1).optional().nullable(),
});
export type CreatePractitionerInput = z.infer<typeof createPractitionerSchema>;

export const updatePractitionerSchema = z.object({
  practitionerId: z.string().min(1),
  name: z.string().min(1).max(150).optional(),
  title: z.string().min(1).max(80).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  defaultRoomId: z.string().min(1).optional().nullable(),
  active: z.boolean().optional(),
});
export type UpdatePractitionerInput = z.infer<typeof updatePractitionerSchema>;

export const createAppointmentTypeSchema = z.object({
  name: z.string().min(1).max(100),
  defaultDurationMin: z.number().int().min(5).max(480),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type CreateAppointmentTypeInput = z.infer<typeof createAppointmentTypeSchema>;

export const updateAppointmentTypeSchema = z.object({
  appointmentTypeId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  defaultDurationMin: z.number().int().min(5).max(480).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  active: z.boolean().optional(),
});
export type UpdateAppointmentTypeInput = z.infer<typeof updateAppointmentTypeSchema>;

export const setWorkingHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
  closed: z.boolean(),
});
export type SetWorkingHoursInput = z.infer<typeof setWorkingHoursSchema>;
