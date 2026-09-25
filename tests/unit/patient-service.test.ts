import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import {
  checkForDuplicates,
  createPatient,
  linkFamilyMember,
  setPatientStatus,
  unlinkFamilyMember,
  updatePatientDetails,
} from "@/lib/services/patient-service";
import { DuplicatePatientError, NotFoundError } from "@/lib/services/errors";
import { PermissionError } from "@/lib/permissions";

async function fixture() {
  await resetDb();
  return seedFixture();
}

describe("patient service", () => {
  it("creates a patient with a unique generated code and audits it", async () => {
    const { actors } = await fixture();

    const patient = await createPatient(actors.reception, {
      firstName: "Layla",
      lastName: "Nassar",
      dateOfBirth: "1995-06-15",
    });

    expect(patient.patientCode).toMatch(/^A\d{5}$/);
    expect(patient.createdById).toBe(actors.reception.id);

    const audit = await prisma.auditLog.findMany({ where: { recordId: patient.id, action: "patient.created" } });
    expect(audit).toHaveLength(1);
  });

  it("flags a likely duplicate on create and allows an explicit override", async () => {
    const { actors, patient1 } = await fixture();

    const duplicates = await checkForDuplicates(actors.reception, {
      firstName: patient1.firstName,
      lastName: patient1.lastName,
      dateOfBirth: patient1.dateOfBirth.toISOString(),
    });
    expect(duplicates.map((d) => d.id)).toContain(patient1.id);

    await expect(
      createPatient(actors.reception, {
        firstName: patient1.firstName,
        lastName: patient1.lastName,
        dateOfBirth: patient1.dateOfBirth.toISOString(),
      })
    ).rejects.toBeInstanceOf(DuplicatePatientError);

    const created = await createPatient(actors.reception, {
      firstName: patient1.firstName,
      lastName: patient1.lastName,
      dateOfBirth: patient1.dateOfBirth.toISOString(),
      overrideDuplicateCheck: true,
    });
    expect(created.id).not.toBe(patient1.id);
  });

  it("updates patient details, stamps updatedBy and persists across a reload", async () => {
    const { actors, patient1 } = await fixture();

    const updated = await updatePatientDetails(actors.reception, {
      patientId: patient1.id,
      city: "Damascus",
      addressLine1: "12 Old Town Street",
      preferredContactMethod: "WHATSAPP",
    });

    expect(updated.city).toBe("Damascus");
    expect(updated.updatedById).toBe(actors.reception.id);

    const reloaded = await prisma.patient.findUniqueOrThrow({ where: { id: patient1.id } });
    expect(reloaded.city).toBe("Damascus");
    expect(reloaded.addressLine1).toBe("12 Old Town Street");
    expect(reloaded.preferredContactMethod).toBe("WHATSAPP");

    const audit = await prisma.auditLog.findMany({
      where: { recordId: patient1.id, action: "patient.detailsUpdated" },
    });
    expect(audit).toHaveLength(1);
  });

  it("archives a patient (admin/manager only) rather than deleting it", async () => {
    const { actors, patient1 } = await fixture();

    await expect(setPatientStatus(actors.reception, { patientId: patient1.id, status: "ARCHIVED" })).rejects.toBeInstanceOf(
      PermissionError
    );

    const archived = await setPatientStatus(actors.admin, { patientId: patient1.id, status: "ARCHIVED" });
    expect(archived.status).toBe("ARCHIVED");

    const stillThere = await prisma.patient.findUnique({ where: { id: patient1.id } });
    expect(stillThere).not.toBeNull();
  });

  it("links two patients as family and the relationship is visible from both sides", async () => {
    const { actors, patient1, patient2 } = await fixture();

    const link = await linkFamilyMember(actors.reception, {
      patientId: patient1.id,
      relatedPatientId: patient2.id,
      relationType: "SPOUSE",
    });

    const fromPatient1 = await prisma.patientFamilyRelationship.findMany({ where: { patientId: patient1.id } });
    const fromPatient2 = await prisma.patientFamilyRelationship.findMany({ where: { relatedPatientId: patient2.id } });
    expect(fromPatient1).toHaveLength(1);
    expect(fromPatient2).toHaveLength(1);
    expect(fromPatient2[0].id).toBe(link.id);

    await unlinkFamilyMember(actors.reception, { relationshipId: link.id });
    const afterUnlink = await prisma.patientFamilyRelationship.findMany({ where: { patientId: patient1.id } });
    expect(afterUnlink).toHaveLength(0);
  });

  it("rejects operations on a patient from another practice", async () => {
    const { actors } = await fixture();
    await expect(
      updatePatientDetails(actors.reception, { patientId: "not-a-real-id", city: "X" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
