import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import { completeChartEntry, createChartEntry, retractChartEntry } from "@/lib/services/chart-service";
import { getChartForPatient, getToothHistory } from "@/lib/services/patient-queries";
import { PermissionError } from "@/lib/permissions";
import { InvalidTransitionError, NotFoundError } from "@/lib/services/errors";

async function fixture() {
  await resetDb();
  return seedFixture();
}

describe("chart service", () => {
  it("blocks a receptionist from charting", async () => {
    const { actors, patient1 } = await fixture();
    await expect(
      createChartEntry(actors.reception, { patientId: patient1.id, toothNumber: "46", itemCode: "FILLING" })
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("blocks a practice manager from charting — can view clinical data, not author it", async () => {
    const { actors, patient1 } = await fixture();
    await expect(
      createChartEntry(actors.manager, { patientId: patient1.id, toothNumber: "46", itemCode: "FILLING" })
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("rejects an invalid FDI tooth number", async () => {
    const { actors, patient1 } = await fixture();
    await expect(
      createChartEntry(actors.clinicianA, { patientId: patient1.id, toothNumber: "99", itemCode: "FILLING" })
    ).rejects.toThrow();
  });

  it("charts a whole-tooth finding and derives dentitionType from the FDI code", async () => {
    const { actors, patient1 } = await fixture();
    const entry = await createChartEntry(actors.clinicianA, {
      patientId: patient1.id,
      toothNumber: "46",
      itemCode: "CROWN",
      status: "EXISTING",
    });
    expect(entry.surface).toBeNull();
    expect(entry.dentitionType).toBe("PERMANENT");
    expect(entry.status).toBe("EXISTING");
  });

  it("charts a deciduous tooth correctly", async () => {
    const { actors, patient1 } = await fixture();
    const entry = await createChartEntry(actors.clinicianA, {
      patientId: patient1.id,
      toothNumber: "84",
      itemCode: "FILLING",
      surface: "OCCLUSAL",
    });
    expect(entry.dentitionType).toBe("DECIDUOUS");
    expect(entry.surface).toBe("OCCLUSAL");
  });

  it("charts a surface-specific finding distinct from a whole-tooth finding on the same tooth", async () => {
    const { actors, patient1 } = await fixture();
    await createChartEntry(actors.clinicianA, { patientId: patient1.id, toothNumber: "46", itemCode: "FILLING", surface: "MESIAL" });
    await createChartEntry(actors.clinicianA, { patientId: patient1.id, toothNumber: "46", itemCode: "FILLING", surface: "OCCLUSAL" });
    await createChartEntry(actors.clinicianA, { patientId: patient1.id, toothNumber: "46", itemCode: "FILLING", surface: "DISTAL" });

    const entries = await getChartForPatient(patient1.practiceId, patient1.id);
    const forTooth46 = entries.filter((e) => e.toothNumber === "46");
    expect(forTooth46).toHaveLength(3);
    expect(new Set(forTooth46.map((e) => e.surface))).toEqual(new Set(["MESIAL", "OCCLUSAL", "DISTAL"]));
  });

  it("marking a tooth missing writes a distinct audit action and never deletes the row on retraction", async () => {
    const { actors, patient1 } = await fixture();
    const entry = await createChartEntry(actors.clinicianA, {
      patientId: patient1.id,
      toothNumber: "46",
      itemCode: "MISSING",
    });

    const audit = await prisma.auditLog.findMany({ where: { recordId: entry.id, action: "chart.toothMarkedMissing" } });
    expect(audit).toHaveLength(1);

    const retracted = await retractChartEntry(actors.clinicianA, { chartEntryId: entry.id, reason: "Data entry error" });
    expect(retracted.active).toBe(false);
    expect(retracted.resolvedById).toBe(actors.clinicianA.id);

    // The row itself is never deleted — it remains in the tooth's history.
    const stillThere = await prisma.chartEntry.findUnique({ where: { id: entry.id } });
    expect(stillThere).not.toBeNull();
  });

  it("only allows completing a PLANNED entry, and audits the transition", async () => {
    const { actors, patient1 } = await fixture();
    const existing = await createChartEntry(actors.clinicianA, {
      patientId: patient1.id,
      toothNumber: "26",
      itemCode: "CROWN",
      status: "EXISTING",
    });
    await expect(completeChartEntry(actors.clinicianA, { chartEntryId: existing.id })).rejects.toBeInstanceOf(InvalidTransitionError);

    const planned = await createChartEntry(actors.clinicianA, {
      patientId: patient1.id,
      toothNumber: "37",
      itemCode: "FILLING",
      surface: "MESIAL",
      status: "PLANNED",
    });
    const completed = await completeChartEntry(actors.clinicianA, { chartEntryId: planned.id });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();

    const audit = await prisma.auditLog.findMany({ where: { recordId: planned.id, action: "chart.entryCompleted" } });
    expect(audit).toHaveLength(1);
  });

  it("rejects operating on a chart entry from another practice", async () => {
    const { actors, patient1 } = await fixture();
    const other = await fixture();
    const entry = await createChartEntry(other.actors.clinicianA, { patientId: other.patient1.id, toothNumber: "46", itemCode: "CROWN" });

    await expect(completeChartEntry(actors.clinicianA, { chartEntryId: entry.id })).rejects.toBeInstanceOf(NotFoundError);
    void patient1;
  });

  it("getToothHistory returns both chart entries and tooth-linked clinical notes for that tooth", async () => {
    const { actors, patient1, drA } = await fixture();
    await createChartEntry(actors.clinicianA, { patientId: patient1.id, toothNumber: "46", itemCode: "CROWN" });
    await prisma.clinicalNote.create({
      data: {
        practiceId: patient1.practiceId,
        patientId: patient1.id,
        practitionerId: drA.id,
        content: "Discussed crown option with patient.",
        toothNumber: "46",
        createdById: actors.clinicianA.id,
      },
    });

    const history = await getToothHistory(patient1.practiceId, patient1.id, "46");
    expect(history.entries).toHaveLength(1);
    expect(history.notes).toHaveLength(1);
  });
});
