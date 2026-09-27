import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import { deleteClinicalImage, uploadClinicalImage } from "@/lib/services/clinical-image-service";
import { getClinicalImages } from "@/lib/services/patient-queries";
import { PermissionError } from "@/lib/permissions";
import { InvalidDocumentFileError } from "@/lib/documents/storage";

async function fixture() {
  await resetDb();
  return seedFixture();
}

const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);

describe("clinical image service", () => {
  it("blocks a receptionist from uploading a clinical image — general documents access doesn't extend to clinical images", async () => {
    const { actors, patient1 } = await fixture();
    await expect(
      uploadClinicalImage(
        actors.reception,
        { patientId: patient1.id, filename: "xray.png", category: "RADIOGRAPH" },
        { buffer: PNG_BUFFER, declaredSize: PNG_BUFFER.byteLength }
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("blocks a practice manager from uploading — can view clinical data, not author it", async () => {
    const { actors, patient1 } = await fixture();
    await expect(
      uploadClinicalImage(
        actors.manager,
        { patientId: patient1.id, filename: "xray.png", category: "RADIOGRAPH" },
        { buffer: PNG_BUFFER, declaredSize: PNG_BUFFER.byteLength }
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("rejects a file whose bytes don't match its extension", async () => {
    const { actors, patient1 } = await fixture();
    const fakeBuffer = Buffer.from("not really a png", "utf-8");
    await expect(
      uploadClinicalImage(
        actors.clinicianA,
        { patientId: patient1.id, filename: "fake.png", category: "RADIOGRAPH" },
        { buffer: fakeBuffer, declaredSize: fakeBuffer.byteLength }
      )
    ).rejects.toBeInstanceOf(InvalidDocumentFileError);
  });

  it("uploads a radiograph, optionally linked to a tooth, and writes an audit entry", async () => {
    const { actors, patient1 } = await fixture();
    const image = await uploadClinicalImage(
      actors.clinicianA,
      { patientId: patient1.id, filename: "molar.png", category: "RADIOGRAPH", toothNumber: "46" },
      { buffer: PNG_BUFFER, declaredSize: PNG_BUFFER.byteLength }
    );
    expect(image.toothNumber).toBe("46");
    expect(image.category).toBe("RADIOGRAPH");

    const audit = await prisma.auditLog.findMany({ where: { recordId: patient1.id, action: "chart.imageUploaded" } });
    expect(audit).toHaveLength(1);
    // The audit trail must never leak the internal storage path.
    expect(JSON.stringify(audit[0].newValue)).not.toContain("storageKey");
  });

  it("soft-deletes an image rather than removing the row, and it disappears from listings", async () => {
    const { actors, patient1 } = await fixture();
    const image = await uploadClinicalImage(
      actors.clinicianA,
      { patientId: patient1.id, filename: "photo.png", category: "INTRAORAL_PHOTO" },
      { buffer: PNG_BUFFER, declaredSize: PNG_BUFFER.byteLength }
    );

    await deleteClinicalImage(actors.clinicianA, { imageId: image.id });
    const reloaded = await prisma.clinicalImage.findUniqueOrThrow({ where: { id: image.id } });
    expect(reloaded.deletedAt).not.toBeNull();

    const listed = await getClinicalImages(patient1.practiceId, patient1.id);
    expect(listed.find((i) => i.id === image.id)).toBeUndefined();
  });
});
