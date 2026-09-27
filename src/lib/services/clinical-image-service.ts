import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { serialize, writeAudit } from "@/lib/services/audit";
import { NotFoundError } from "@/lib/services/errors";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  detectAndValidateType,
  InvalidDocumentFileError,
  saveDocumentFile,
} from "@/lib/documents/storage";
import { deleteClinicalImageSchema, uploadClinicalImageMetaSchema } from "@/lib/validation/clinical-image";

/**
 * Clinical images/radiographs — gated by patients.manageClinicalImages
 * (Clinician/Admin only), unlike the general patient-record documents
 * service which a Receptionist can also use. Reuses the same private
 * file-storage abstraction (lib/documents/storage.ts) as PatientDocument.
 */
export async function uploadClinicalImage(
  actor: Actor,
  rawMeta: unknown,
  file: { buffer: Buffer; declaredSize: number }
) {
  const meta = uploadClinicalImageMetaSchema.parse(rawMeta);
  assertCan(actor.role, "patients.manageClinicalImages");

  if (file.declaredSize > MAX_DOCUMENT_SIZE_BYTES || file.buffer.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw new InvalidDocumentFileError("File is too large (15MB max).");
  }

  const mimeType = detectAndValidateType(meta.filename, file.buffer);

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: meta.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    if (meta.chartEntryId) {
      const chartEntry = await tx.chartEntry.findFirst({
        where: { id: meta.chartEntryId, practiceId: actor.practiceId, patientId: meta.patientId },
      });
      if (!chartEntry) throw new NotFoundError("Chart entry not found");
    }

    const storageKey = await saveDocumentFile({
      practiceId: actor.practiceId,
      patientId: meta.patientId,
      filename: meta.filename,
      buffer: file.buffer,
    });

    const image = await tx.clinicalImage.create({
      data: {
        patientId: meta.patientId,
        practiceId: actor.practiceId,
        toothNumber: meta.toothNumber ?? null,
        chartEntryId: meta.chartEntryId ?? null,
        category: meta.category,
        filename: meta.filename,
        storageKey,
        mimeType,
        sizeBytes: file.buffer.byteLength,
        description: meta.description ?? null,
        capturedDate: meta.capturedDate ?? new Date(),
        uploadedById: actor.id,
      },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "chart.imageUploaded",
      recordType: "Patient",
      recordId: meta.patientId,
      previousValue: null,
      newValue: serialize({ ...image, storageKey: undefined }),
    });

    return image;
  });
}

export async function deleteClinicalImage(actor: Actor, rawInput: unknown) {
  const input = deleteClinicalImageSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageClinicalImages");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.clinicalImage.findFirst({
      where: { id: input.imageId },
      include: { patient: true },
    });
    if (!existing || existing.patient.practiceId !== actor.practiceId || existing.deletedAt) {
      throw new NotFoundError("Image not found");
    }

    const updated = await tx.clinicalImage.update({
      where: { id: input.imageId },
      data: { deletedAt: new Date() },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "chart.imageDeleted",
      recordType: "Patient",
      recordId: existing.patientId,
      previousValue: { filename: existing.filename },
      newValue: null,
    });

    return updated;
  });
}
