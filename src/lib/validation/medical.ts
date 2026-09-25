import { z } from "zod";

export const medicalAnswerSchema = z.object({
  questionKey: z.string().min(1),
  answer: z.enum(["YES", "NO", "UNKNOWN", "NOT_APPLICABLE"]).optional().nullable(),
  // Free text for FREE_TEXT questions, or the selected option code for
  // SELECT questions (e.g. "CURRENT" for smokingStatus).
  freeText: z.string().max(1000).optional().nullable(),
});

export const submitMedicalHistorySchema = z.object({
  patientId: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
  answers: z.array(medicalAnswerSchema).min(1),
});
export type SubmitMedicalHistoryInput = z.infer<typeof submitMedicalHistorySchema>;

export const addMedicalAlertSchema = z.object({
  patientId: z.string().min(1),
  label: z.string().min(1).max(200),
});

export const resolveMedicalAlertSchema = z.object({
  alertId: z.string().min(1),
});
