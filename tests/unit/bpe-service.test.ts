import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import { createBpeExam } from "@/lib/services/bpe-service";
import { getBpeExams } from "@/lib/services/patient-queries";
import { PermissionError } from "@/lib/permissions";

async function fixture() {
  await resetDb();
  return seedFixture();
}

const SIX_SEXTANTS = [
  { sextant: "UPPER_RIGHT" as const, code: "1" as const },
  { sextant: "UPPER_ANTERIOR" as const, code: "0" as const },
  { sextant: "UPPER_LEFT" as const, code: "2" as const },
  { sextant: "LOWER_RIGHT" as const, code: "1" as const },
  { sextant: "LOWER_ANTERIOR" as const, code: "0" as const },
  { sextant: "LOWER_LEFT" as const, code: "*" as const },
];

describe("BPE service", () => {
  it("blocks a receptionist from recording a BPE exam", async () => {
    const { actors, patient1 } = await fixture();
    await expect(createBpeExam(actors.reception, { patientId: patient1.id, scores: SIX_SEXTANTS })).rejects.toBeInstanceOf(
      PermissionError
    );
  });

  it("blocks a practice manager from recording a BPE exam — can view clinical data, not author it", async () => {
    const { actors, patient1 } = await fixture();
    await expect(createBpeExam(actors.manager, { patientId: patient1.id, scores: SIX_SEXTANTS })).rejects.toBeInstanceOf(
      PermissionError
    );
  });

  it("rejects a duplicate sextant in the same exam", async () => {
    const { actors, patient1 } = await fixture();
    await expect(
      createBpeExam(actors.clinicianA, {
        patientId: patient1.id,
        scores: [...SIX_SEXTANTS.slice(0, 5), { sextant: "UPPER_RIGHT", code: "3" }],
      })
    ).rejects.toThrow();
  });

  it("creates an exam with all six sextants and writes an audit entry", async () => {
    const { actors, patient1 } = await fixture();
    const exam = await createBpeExam(actors.clinicianA, {
      patientId: patient1.id,
      notes: "Generalised mild gingivitis.",
      scores: SIX_SEXTANTS,
    });
    expect(exam.scores).toHaveLength(6);
    expect(exam.scores.find((s) => s.sextant === "LOWER_LEFT")?.code).toBe("*");

    const audit = await prisma.auditLog.findMany({ where: { recordId: exam.id, action: "chart.bpeCreated" } });
    expect(audit).toHaveLength(1);
  });

  it("lists exams most recent first", async () => {
    const { actors, patient1 } = await fixture();
    const first = await createBpeExam(actors.clinicianA, {
      patientId: patient1.id,
      examDate: new Date("2024-01-01"),
      scores: SIX_SEXTANTS,
    });
    const second = await createBpeExam(actors.clinicianA, {
      patientId: patient1.id,
      examDate: new Date("2025-01-01"),
      scores: SIX_SEXTANTS,
    });

    const exams = await getBpeExams(patient1.practiceId, patient1.id);
    expect(exams.map((e) => e.id)).toEqual([second.id, first.id]);
  });
});
