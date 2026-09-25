import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { serialize, writeAudit } from "@/lib/services/audit";
import { NotFoundError } from "@/lib/services/errors";
import {
  InvalidDocumentFileError,
  MAX_DOCUMENT_SIZE_BYTES,
  detectAndValidateType,
  saveDocumentFile,
} from "@/lib/documents/storage";
import {
  addFlagSchema,
  createPatientNoteSchema,
  createTaskSchema,
  resolveFlagSchema,
  updateTaskStatusSchema,
  uploadDocumentMetaSchema,
  deleteDocumentSchema,
} from "@/lib/validation/patient-record";

// -- Non-clinical (administrative) patient notes --------------------------
// Deliberately a separate model/service from clinical notes so the two
// families of data are never fetched or rendered together.

export async function createPatientNote(actor: Actor, rawInput: unknown) {
  const input = createPatientNoteSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageAdminNotes");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    const note = await tx.patientNote.create({
      data: { patientId: input.patientId, content: input.content, createdById: actor.id },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.adminNoteCreated",
      recordType: "Patient",
      recordId: input.patientId,
      previousValue: null,
      newValue: serialize(note),
    });
    return note;
  });
}

// -- Tasks ------------------------------------------------------------------

export async function createTask(actor: Actor, rawInput: unknown) {
  const input = createTaskSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageTasks");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    const task = await tx.patientTask.create({
      data: {
        practiceId: actor.practiceId,
        patientId: input.patientId,
        appointmentId: input.appointmentId || null,
        title: input.title,
        assignedToUserId: input.assignedToUserId || null,
        dueAt: input.dueAt ?? null,
        createdById: actor.id,
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.taskCreated",
      recordType: "Patient",
      recordId: input.patientId,
      previousValue: null,
      newValue: serialize(task),
    });
    return task;
  });
}

export async function updateTaskStatus(actor: Actor, rawInput: unknown) {
  const input = updateTaskStatusSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageTasks");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.patientTask.findFirst({ where: { id: input.taskId, practiceId: actor.practiceId } });
    if (!existing) throw new NotFoundError("Task not found");

    const updated = await tx.patientTask.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
        completedAt: input.status === "COMPLETED" ? new Date() : existing.completedAt,
      },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.taskStatusChanged",
      recordType: "Patient",
      recordId: existing.patientId,
      previousValue: { status: existing.status },
      newValue: { status: input.status },
    });

    return updated;
  });
}

// -- Flags --------------------------------------------------------------

export async function addFlag(actor: Actor, rawInput: unknown) {
  const input = addFlagSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageFlags");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    const flag = await tx.patientFlag.create({
      data: { patientId: input.patientId, flagKey: input.flagKey, notes: input.notes ?? null, createdById: actor.id },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.flagAdded",
      recordType: "Patient",
      recordId: input.patientId,
      previousValue: null,
      newValue: serialize(flag),
    });
    return flag;
  });
}

export async function resolveFlag(actor: Actor, rawInput: unknown) {
  const input = resolveFlagSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageFlags");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.patientFlag.findFirst({ where: { id: input.flagId }, include: { patient: true } });
    if (!existing || existing.patient.practiceId !== actor.practiceId) throw new NotFoundError("Flag not found");

    const updated = await tx.patientFlag.update({
      where: { id: input.flagId },
      data: { active: false, resolvedAt: new Date() },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.flagRemoved",
      recordType: "Patient",
      recordId: existing.patientId,
      previousValue: serialize(existing),
      newValue: serialize(updated),
    });

    return updated;
  });
}

// -- Documents ------------------------------------------------------------

export async function uploadDocument(
  actor: Actor,
  rawMeta: unknown,
  file: { buffer: Buffer; declaredSize: number }
) {
  const meta = uploadDocumentMetaSchema.parse(rawMeta);
  assertCan(actor.role, "patients.manageDocuments");

  if (file.declaredSize > MAX_DOCUMENT_SIZE_BYTES || file.buffer.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw new InvalidDocumentFileError("File is too large (15MB max).");
  }

  const mimeType = detectAndValidateType(meta.filename, file.buffer);

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: meta.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    const storageKey = await saveDocumentFile({
      practiceId: actor.practiceId,
      patientId: meta.patientId,
      filename: meta.filename,
      buffer: file.buffer,
    });

    const document = await tx.patientDocument.create({
      data: {
        patientId: meta.patientId,
        filename: meta.filename,
        storageKey,
        mimeType,
        sizeBytes: file.buffer.byteLength,
        category: meta.category,
        description: meta.description ?? null,
        uploadedById: actor.id,
      },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.documentUploaded",
      recordType: "Patient",
      recordId: meta.patientId,
      previousValue: null,
      newValue: serialize({ ...document, storageKey: undefined }),
    });

    return document;
  });
}

export async function deleteDocument(actor: Actor, rawInput: unknown) {
  const input = deleteDocumentSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageDocuments");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.patientDocument.findFirst({
      where: { id: input.documentId },
      include: { patient: true },
    });
    if (!existing || existing.patient.practiceId !== actor.practiceId || existing.deletedAt) {
      throw new NotFoundError("Document not found");
    }

    const updated = await tx.patientDocument.update({
      where: { id: input.documentId },
      data: { deletedAt: new Date() },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.documentDeleted",
      recordType: "Patient",
      recordId: existing.patientId,
      previousValue: { filename: existing.filename },
      newValue: null,
    });

    return updated;
  });
}
