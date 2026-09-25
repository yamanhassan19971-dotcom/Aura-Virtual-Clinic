import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import { addMedicalAlert, resolveMedicalAlert, submitMedicalHistory } from "@/lib/services/medical-service";
import { PermissionError } from "@/lib/permissions";

async function fixture() {
  await resetDb();
  return seedFixture();
}

describe("medical history service", () => {
  it("blocks a receptionist from submitting medical history", async () => {
    const { actors, patient1 } = await fixture();
    await expect(
      submitMedicalHistory(actors.reception, {
        patientId: patient1.id,
        answers: [{ questionKey: "diabetes", answer: "NO" }],
      })
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("versions medical history — a new submission never overwrites the previous one", async () => {
    const { actors, patient1 } = await fixture();

    const first = await submitMedicalHistory(actors.clinicianA, {
      patientId: patient1.id,
      notes: "Initial visit",
      answers: [
        { questionKey: "diabetes", answer: "NO" },
        { questionKey: "drugAllergies", answer: "NO" },
      ],
    });
    expect(first.status).toBe("CURRENT");

    const second = await submitMedicalHistory(actors.clinicianA, {
      patientId: patient1.id,
      notes: "Follow-up update",
      answers: [
        { questionKey: "diabetes", answer: "YES" },
        { questionKey: "drugAllergies", answer: "NO" },
      ],
    });
    expect(second.status).toBe("CURRENT");
    expect(second.id).not.toBe(first.id);

    const firstReloaded = await prisma.medicalHistory.findUniqueOrThrow({ where: { id: first.id } });
    expect(firstReloaded.status).toBe("PREVIOUS");
    expect(firstReloaded.notes).toBe("Initial visit"); // untouched

    const allHistories = await prisma.medicalHistory.findMany({ where: { patientId: patient1.id } });
    expect(allHistories).toHaveLength(2);
  });

  it("generates a medical alert from a flagged answer and it appears active for the patient", async () => {
    const { actors, patient1 } = await fixture();

    await submitMedicalHistory(actors.clinicianA, {
      patientId: patient1.id,
      answers: [{ questionKey: "drugAllergies", answer: "YES", freeText: "Penicillin" }],
    });

    const alerts = await prisma.medicalAlert.findMany({ where: { patientId: patient1.id, active: true } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].label).toBe("drugAllergies::Penicillin");
  });

  it("does not duplicate an already-active alert on a later submission", async () => {
    const { actors, patient1 } = await fixture();

    await submitMedicalHistory(actors.clinicianA, {
      patientId: patient1.id,
      answers: [{ questionKey: "diabetes", answer: "YES" }],
    });
    await submitMedicalHistory(actors.clinicianA, {
      patientId: patient1.id,
      answers: [{ questionKey: "diabetes", answer: "YES" }],
    });

    const alerts = await prisma.medicalAlert.findMany({ where: { patientId: patient1.id, active: true } });
    expect(alerts).toHaveLength(1);
  });

  it("lets a clinician manually add and resolve an alert without deleting its history", async () => {
    const { actors, patient1 } = await fixture();

    const alert = await addMedicalAlert(actors.clinicianA, { patientId: patient1.id, label: "High anxiety patient" });
    let active = await prisma.medicalAlert.findMany({ where: { patientId: patient1.id, active: true } });
    expect(active).toHaveLength(1);

    await resolveMedicalAlert(actors.clinicianA, { alertId: alert.id });
    active = await prisma.medicalAlert.findMany({ where: { patientId: patient1.id, active: true } });
    expect(active).toHaveLength(0);

    const stillExists = await prisma.medicalAlert.findUnique({ where: { id: alert.id } });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.resolvedById).toBe(actors.clinicianA.id);
  });
});
