import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { serialize, writeAudit } from "@/lib/services/audit";
import { NotFoundError } from "@/lib/services/errors";
import { createBpeExamSchema } from "@/lib/validation/bpe";
import type { Prisma } from "@prisma/client";

export const BPE_EXAM_INCLUDE = {
  practitioner: { select: { name: true } },
  createdBy: { select: { name: true } },
  scores: true,
} satisfies Prisma.BpeExamInclude;

export type BpeExamWithRelations = Prisma.BpeExamGetPayload<{ include: typeof BPE_EXAM_INCLUDE }>;

/** Foundation-level BPE only (six sextant codes) — see the BpeExam model comment in schema.prisma. */
export async function createBpeExam(actor: Actor, rawInput: unknown) {
  const input = createBpeExamSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageBpe");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    if (input.practitionerId) {
      const practitioner = await tx.practitioner.findFirst({
        where: { id: input.practitionerId, practiceId: actor.practiceId },
      });
      if (!practitioner) throw new NotFoundError("Practitioner not found");
    }

    const exam = await tx.bpeExam.create({
      data: {
        practiceId: actor.practiceId,
        patientId: input.patientId,
        practitionerId: input.practitionerId ?? actor.practitionerId ?? null,
        examDate: input.examDate ?? new Date(),
        notes: input.notes ?? null,
        createdById: actor.id,
        scores: { create: input.scores.map((s) => ({ sextant: s.sextant, code: s.code })) },
      },
      include: BPE_EXAM_INCLUDE,
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "chart.bpeCreated",
      recordType: "BpeExam",
      recordId: exam.id,
      previousValue: null,
      newValue: serialize(exam),
    });

    return exam;
  });
}
