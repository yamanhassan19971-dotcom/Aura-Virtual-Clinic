import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { serialize, writeAudit } from "@/lib/services/audit";
import { NotFoundError, RecordLockedError } from "@/lib/services/errors";
import {
  addNoteAmendmentSchema,
  createClinicalNoteSchema,
  createNoteTemplateSchema,
  signClinicalNoteSchema,
  updateClinicalNoteDraftSchema,
} from "@/lib/validation/clinical-note";

export async function createClinicalNote(actor: Actor, rawInput: unknown) {
  const input = createClinicalNoteSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageClinicalNotes");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");
    const practitioner = await tx.practitioner.findFirst({
      where: { id: input.practitionerId, practiceId: actor.practiceId },
    });
    if (!practitioner) throw new NotFoundError("Practitioner not found");

    const note = await tx.clinicalNote.create({
      data: {
        practiceId: actor.practiceId,
        patientId: input.patientId,
        appointmentId: input.appointmentId || null,
        practitionerId: input.practitionerId,
        content: input.content,
        createdById: actor.id,
      },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.noteCreated",
      recordType: "ClinicalNote",
      recordId: note.id,
      previousValue: null,
      newValue: serialize(note),
    });

    return note;
  });
}

export async function updateClinicalNoteDraft(actor: Actor, rawInput: unknown) {
  const input = updateClinicalNoteDraftSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageClinicalNotes");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.clinicalNote.findFirst({ where: { id: input.noteId, practiceId: actor.practiceId } });
    if (!existing) throw new NotFoundError("Clinical note not found");
    if (existing.status !== "DRAFT") throw new RecordLockedError();

    const updated = await tx.clinicalNote.update({ where: { id: input.noteId }, data: { content: input.content } });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.noteEdited",
      recordType: "ClinicalNote",
      recordId: input.noteId,
      previousValue: serialize(existing),
      newValue: serialize(updated),
    });

    return updated;
  });
}

/** Signing freezes `content` permanently — later corrections go through addNoteAmendment, never another edit here. */
export async function signClinicalNote(actor: Actor, rawInput: unknown) {
  const input = signClinicalNoteSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageClinicalNotes");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.clinicalNote.findFirst({ where: { id: input.noteId, practiceId: actor.practiceId } });
    if (!existing) throw new NotFoundError("Clinical note not found");
    if (existing.status !== "DRAFT") throw new RecordLockedError("This note is already signed.");

    const signed = await tx.clinicalNote.update({
      where: { id: input.noteId },
      data: { status: "SIGNED", signedAt: new Date(), signedById: actor.id },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.noteSigned",
      recordType: "ClinicalNote",
      recordId: input.noteId,
      previousValue: { status: existing.status },
      newValue: { status: "SIGNED" },
    });

    return signed;
  });
}

export async function addNoteAmendment(actor: Actor, rawInput: unknown) {
  const input = addNoteAmendmentSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageClinicalNotes");

  return prisma.$transaction(async (tx) => {
    const note = await tx.clinicalNote.findFirst({ where: { id: input.noteId, practiceId: actor.practiceId } });
    if (!note) throw new NotFoundError("Clinical note not found");
    if (note.status !== "SIGNED") {
      throw new RecordLockedError("Only a signed note can receive an amendment — edit the draft directly instead.");
    }

    const amendment = await tx.clinicalNoteAmendment.create({
      data: { clinicalNoteId: input.noteId, content: input.content, createdById: actor.id },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.noteAmended",
      recordType: "ClinicalNote",
      recordId: input.noteId,
      previousValue: null,
      newValue: serialize(amendment),
    });

    return amendment;
  });
}

export async function createNoteTemplate(actor: Actor, rawInput: unknown) {
  const input = createNoteTemplateSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageNoteTemplates");

  const template = await prisma.clinicalNoteTemplate.create({
    data: {
      practiceId: actor.practiceId,
      ownerUserId: input.personal ? actor.id : null,
      title: input.title,
      body: input.body,
    },
  });
  return template;
}
