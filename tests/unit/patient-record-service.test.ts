import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import {
  addFlag,
  createPatientNote,
  createTask,
  deleteDocument,
  resolveFlag,
  updateTaskStatus,
  uploadDocument,
} from "@/lib/services/patient-record-service";
import { InvalidDocumentFileError } from "@/lib/documents/storage";

async function fixture() {
  await resetDb();
  return seedFixture();
}

describe("patient record service", () => {
  it("creates an administrative note, distinct from clinical notes", async () => {
    const { actors, patient1 } = await fixture();
    const note = await createPatientNote(actors.reception, {
      patientId: patient1.id,
      content: "Prefers afternoon appointments.",
    });
    expect(note.content).toContain("afternoon");

    const clinicalCount = await prisma.clinicalNote.count({ where: { patientId: patient1.id } });
    expect(clinicalCount).toBe(0);
  });

  it("creates and completes a task", async () => {
    const { actors, patient1 } = await fixture();
    const task = await createTask(actors.reception, {
      patientId: patient1.id,
      title: "Call patient regarding treatment plan",
    });
    expect(task.status).toBe("OPEN");

    const completed = await updateTaskStatus(actors.reception, { taskId: task.id, status: "COMPLETED" });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();
  });

  it("adds and resolves a patient flag without deleting the row", async () => {
    const { actors, patient1 } = await fixture();
    const flag = await addFlag(actors.reception, { patientId: patient1.id, flagKey: "VIP" });
    expect(flag.active).toBe(true);

    await resolveFlag(actors.reception, { flagId: flag.id });
    const reloaded = await prisma.patientFlag.findUniqueOrThrow({ where: { id: flag.id } });
    expect(reloaded.active).toBe(false);
  });

  it("accepts a synthetic PDF upload and rejects a file whose bytes don't match its extension", async () => {
    const { actors, patient1 } = await fixture();

    const pdfBuffer = Buffer.from("%PDF-1.4\n%synthetic test file\n", "utf-8");
    const doc = await uploadDocument(
      actors.reception,
      { patientId: patient1.id, filename: "consent-form.pdf", category: "CONSENT" },
      { buffer: pdfBuffer, declaredSize: pdfBuffer.byteLength }
    );
    expect(doc.mimeType).toBe("application/pdf");
    expect(doc.filename).toBe("consent-form.pdf");

    const fakeBuffer = Buffer.from("not really a pdf", "utf-8");
    await expect(
      uploadDocument(
        actors.reception,
        { patientId: patient1.id, filename: "fake.pdf", category: "OTHER" },
        { buffer: fakeBuffer, declaredSize: fakeBuffer.byteLength }
      )
    ).rejects.toBeInstanceOf(InvalidDocumentFileError);
  });

  it("soft-deletes a document rather than removing the row", async () => {
    const { actors, patient1 } = await fixture();
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
    const doc = await uploadDocument(
      actors.reception,
      { patientId: patient1.id, filename: "xray.png", category: "RADIOGRAPH" },
      { buffer: pngBuffer, declaredSize: pngBuffer.byteLength }
    );

    await deleteDocument(actors.reception, { documentId: doc.id });
    const reloaded = await prisma.patientDocument.findUniqueOrThrow({ where: { id: doc.id } });
    expect(reloaded.deletedAt).not.toBeNull();
  });

});
