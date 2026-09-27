import { z } from "zod";
import { BPE_CODES, BPE_SEXTANTS } from "@/lib/dental/chart-item-catalog";

export const createBpeExamSchema = z.object({
  patientId: z.string().min(1),
  practitionerId: z.string().min(1).optional().nullable(),
  examDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional().nullable(),
  scores: z
    .array(
      z.object({
        sextant: z.enum(BPE_SEXTANTS),
        code: z.enum(BPE_CODES),
      })
    )
    .min(1)
    .max(6)
    .refine((scores) => new Set(scores.map((s) => s.sextant)).size === scores.length, {
      message: "Each sextant can only appear once.",
    }),
});
export type CreateBpeExamInput = z.infer<typeof createBpeExamSchema>;
