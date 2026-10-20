import { z } from "zod";
import { Role } from "@prisma/client";

/** Shortest password a staff member may choose for themselves. */
export const MIN_PASSWORD_LENGTH = 10;

const loginEmail = z.string().trim().toLowerCase().email().max(200);

export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: loginEmail,
  role: z.enum(Role),
  // A doctor's login is tied to their diary column (Clinician or Admin).
  practitionerId: z.string().min(1).optional().nullable(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1).max(150).optional(),
  role: z.enum(Role).optional(),
  practitionerId: z.string().min(1).optional().nullable(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const staffRefSchema = z.object({ userId: z.string().min(1) });

export const setStaffActiveSchema = z.object({ userId: z.string().min(1), active: z.boolean() });

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"] });
