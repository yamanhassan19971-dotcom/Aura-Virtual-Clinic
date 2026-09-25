import { z } from "zod";

export const createPatientNoteSchema = z.object({
  patientId: z.string().min(1),
  content: z.string().min(1).max(4000),
});

export const createTaskSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().min(1).optional().nullable(),
  title: z.string().min(1).max(200),
  assignedToUserId: z.string().min(1).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
});

export const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

export const flagKeySchema = z.enum([
  "VIP",
  "HIGH_ANXIETY",
  "INTERPRETER_REQUIRED",
  "COMMUNICATION_PREFERENCE",
  "OUTSTANDING_BALANCE",
  "CONSENT_REQUIRED",
]);

export const addFlagSchema = z.object({
  patientId: z.string().min(1),
  flagKey: flagKeySchema,
  notes: z.string().max(500).optional().nullable(),
});

export const resolveFlagSchema = z.object({
  flagId: z.string().min(1),
});

export const documentCategorySchema = z.enum([
  "RADIOGRAPH",
  "CLINICAL_PHOTOGRAPH",
  "REFERRAL",
  "MEDICAL_REPORT",
  "CONSENT",
  "LAB",
  "CORRESPONDENCE",
  "OTHER",
]);

export const uploadDocumentMetaSchema = z.object({
  patientId: z.string().min(1),
  filename: z.string().min(1).max(200),
  category: documentCategorySchema.default("OTHER"),
  description: z.string().max(500).optional().nullable(),
});

export const deleteDocumentSchema = z.object({
  documentId: z.string().min(1),
});
