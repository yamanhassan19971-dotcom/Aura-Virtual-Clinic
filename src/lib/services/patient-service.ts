import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { serialize, writeAudit } from "@/lib/services/audit";
import { DuplicatePatientError, NotFoundError } from "@/lib/services/errors";
import {
  checkDuplicatesSchema,
  familyRelationTypeSchema,
  linkFamilySchema,
  newPatientSchema,
  setPatientStatusSchema,
  unlinkFamilySchema,
  updatePatientDetailsSchema,
} from "@/lib/validation/patient";
import { z } from "zod";

async function nextPatientCode(practiceId: string): Promise<string> {
  const last = await prisma.patient.findFirst({
    where: { practiceId },
    orderBy: { patientCode: "desc" },
    select: { patientCode: true },
  });
  const lastNumber = last ? parseInt(last.patientCode.replace(/\D/g, ""), 10) : 0;
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
  return `A${String(next).padStart(5, "0")}`;
}

async function findPossibleDuplicates(
  practiceId: string,
  params: { firstName: string; lastName: string; dateOfBirth?: Date; phone?: string | null }
) {
  const digitsOnly = params.phone ? params.phone.replace(/[^0-9]/g, "") : "";

  const nameMatch: Prisma.PatientWhereInput = {
    firstName: { equals: params.firstName, mode: "insensitive" },
    lastName: { equals: params.lastName, mode: "insensitive" },
    ...(params.dateOfBirth ? { dateOfBirth: params.dateOfBirth } : {}),
  };

  const or: Prisma.PatientWhereInput[] = [nameMatch];
  if (digitsOnly.length >= 6) {
    or.push({ phone: { contains: digitsOnly } });
  }

  return prisma.patient.findMany({
    where: { practiceId, status: { not: "ARCHIVED" }, OR: or },
    take: 5,
  });
}

export async function checkForDuplicates(actor: Actor, rawInput: unknown) {
  const input = checkDuplicatesSchema.parse(rawInput);
  return findPossibleDuplicates(actor.practiceId, input);
}

export async function createPatient(actor: Actor, rawInput: unknown) {
  const input = newPatientSchema.parse(rawInput);
  assertCan(actor.role, "patients.create");

  if (!input.overrideDuplicateCheck) {
    const duplicates = await findPossibleDuplicates(actor.practiceId, {
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      phone: input.phone,
    });
    if (duplicates.length > 0) {
      throw new DuplicatePatientError(duplicates);
    }
  }

  return prisma.$transaction(async (tx) => {
    const patientCode = await nextPatientCode(actor.practiceId);
    const patient = await tx.patient.create({
      data: {
        practiceId: actor.practiceId,
        patientCode,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        phone: input.phone || null,
        email: input.email || null,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.created",
      recordType: "Patient",
      recordId: patient.id,
      previousValue: null,
      newValue: serialize(patient),
    });
    return patient;
  });
}

export async function updatePatientDetails(actor: Actor, rawInput: unknown) {
  const input = updatePatientDetailsSchema.parse(rawInput);
  assertCan(actor.role, "patients.editDemographics");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!existing) throw new NotFoundError("Patient not found");

    const { patientId, ...fields } = input;
    const data: Prisma.PatientUncheckedUpdateInput = { updatedById: actor.id };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value === "" ? null : value;
      }
    }

    const updated = await tx.patient.update({ where: { id: patientId }, data });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.detailsUpdated",
      recordType: "Patient",
      recordId: patientId,
      previousValue: serialize(existing),
      newValue: serialize(updated),
    });

    return updated;
  });
}

export async function setPatientStatus(actor: Actor, rawInput: unknown) {
  const input = setPatientStatusSchema.parse(rawInput);
  assertCan(actor.role, input.status === "ARCHIVED" ? "patients.archive" : "patients.editDemographics");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!existing) throw new NotFoundError("Patient not found");

    const updated = await tx.patient.update({
      where: { id: input.patientId },
      data: { status: input.status, updatedById: actor.id },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: input.status === "ARCHIVED" ? "patient.archived" : "patient.statusChanged",
      recordType: "Patient",
      recordId: input.patientId,
      previousValue: { status: existing.status },
      newValue: { status: input.status },
    });

    return updated;
  });
}

// From patientId's perspective, what relatedPatientId is to them; used to
// derive the label shown on the *other* patient's family list without a
// second stored row.
const RECIPROCAL_RELATION: Record<z.infer<typeof familyRelationTypeSchema>, z.infer<typeof familyRelationTypeSchema>> = {
  SPOUSE: "SPOUSE",
  PARENT: "CHILD",
  CHILD: "PARENT",
  SIBLING: "SIBLING",
  GUARDIAN: "CHILD",
  OTHER: "OTHER",
};

export function reciprocalRelation(type: z.infer<typeof familyRelationTypeSchema>) {
  return RECIPROCAL_RELATION[type];
}

export async function linkFamilyMember(actor: Actor, rawInput: unknown) {
  const input = linkFamilySchema.parse(rawInput);
  assertCan(actor.role, "patients.manageFamily");

  if (input.patientId === input.relatedPatientId) {
    throw new NotFoundError("A patient cannot be linked to themself");
  }

  return prisma.$transaction(async (tx) => {
    const [patient, related] = await Promise.all([
      tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } }),
      tx.patient.findFirst({ where: { id: input.relatedPatientId, practiceId: actor.practiceId } }),
    ]);
    if (!patient || !related) throw new NotFoundError("Patient not found");

    const existing = await tx.patientFamilyRelationship.findFirst({
      where: {
        OR: [
          { patientId: input.patientId, relatedPatientId: input.relatedPatientId },
          { patientId: input.relatedPatientId, relatedPatientId: input.patientId },
        ],
      },
    });
    if (existing) {
      return existing;
    }

    const relationship = await tx.patientFamilyRelationship.create({
      data: {
        patientId: input.patientId,
        relatedPatientId: input.relatedPatientId,
        relationType: input.relationType,
        createdById: actor.id,
      },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.familyLinked",
      recordType: "Patient",
      recordId: input.patientId,
      previousValue: null,
      newValue: serialize(relationship),
    });

    return relationship;
  });
}

export async function unlinkFamilyMember(actor: Actor, rawInput: unknown) {
  const input = unlinkFamilySchema.parse(rawInput);
  assertCan(actor.role, "patients.manageFamily");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.patientFamilyRelationship.findFirst({
      where: { id: input.relationshipId },
      include: { patient: true },
    });
    if (!existing || existing.patient.practiceId !== actor.practiceId) {
      throw new NotFoundError("Family relationship not found");
    }

    await tx.patientFamilyRelationship.delete({ where: { id: input.relationshipId } });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.familyUnlinked",
      recordType: "Patient",
      recordId: existing.patientId,
      previousValue: serialize(existing),
      newValue: null,
    });

    return { ok: true };
  });
}
