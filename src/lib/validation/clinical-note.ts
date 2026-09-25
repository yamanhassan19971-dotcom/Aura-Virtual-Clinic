import { z } from "zod";

export const createClinicalNoteSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().min(1).optional().nullable(),
  practitionerId: z.string().min(1),
  content: z.string().min(1).max(20000),
});
export type CreateClinicalNoteInput = z.infer<typeof createClinicalNoteSchema>;

export const updateClinicalNoteDraftSchema = z.object({
  noteId: z.string().min(1),
  content: z.string().min(1).max(20000),
});

export const signClinicalNoteSchema = z.object({
  noteId: z.string().min(1),
});

export const addNoteAmendmentSchema = z.object({
  noteId: z.string().min(1),
  content: z.string().min(1).max(20000),
});

export const createNoteTemplateSchema = z.object({
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(20000),
  personal: z.boolean().default(true),
});
