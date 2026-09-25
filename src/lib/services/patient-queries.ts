import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APPOINTMENT_INCLUDE } from "@/lib/services/appointment-service";
import { reciprocalRelation } from "@/lib/services/patient-service";

export async function getPatientHeader(practiceId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, practiceId },
    include: {
      preferredPractitioner: { select: { name: true } },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });
  if (!patient) return null;

  const [alerts, flags] = await Promise.all([
    prisma.medicalAlert.findMany({ where: { patientId, active: true }, orderBy: { createdAt: "desc" } }),
    prisma.patientFlag.findMany({ where: { patientId, active: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return { patient, alerts, flags };
}

export async function getPatientOverview(practiceId: string, patientId: string) {
  const now = new Date();
  const [nextAppointment, currentMedicalHistory, lastClinicalNote, recentNotes, recentDocuments, openTasks] =
    await Promise.all([
      prisma.appointment.findFirst({
        where: { practiceId, patientId, startTime: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } },
        include: APPOINTMENT_INCLUDE,
        orderBy: { startTime: "asc" },
      }),
      prisma.medicalHistory.findFirst({
        where: { patientId, status: "CURRENT" },
        include: { completedBy: { select: { name: true } } },
      }),
      prisma.clinicalNote.findFirst({
        where: { patientId },
        include: { practitioner: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.clinicalNote.findMany({
        where: { patientId },
        include: { practitioner: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.patientDocument.findMany({
        where: { patientId, deletedAt: null },
        orderBy: { uploadedAt: "desc" },
        take: 5,
      }),
      prisma.patientTask.findMany({
        where: { practiceId, patientId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { dueAt: "asc" },
        take: 10,
      }),
    ]);

  return { nextAppointment, currentMedicalHistory, lastClinicalNote, recentNotes, recentDocuments, openTasks };
}

export async function getPatientAppointments(practiceId: string, patientId: string) {
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.appointment.findMany({
      where: { practiceId, patientId, startTime: { gte: now }, status: { notIn: ["CANCELLED", "FTA"] } },
      include: APPOINTMENT_INCLUDE,
      orderBy: { startTime: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        practiceId,
        patientId,
        OR: [{ startTime: { lt: now } }, { status: { in: ["CANCELLED", "FTA", "COMPLETED"] } }],
      },
      include: APPOINTMENT_INCLUDE,
      orderBy: { startTime: "desc" },
      take: 50,
    }),
  ]);
  return { upcoming, past };
}

export async function getMedicalHistoryList(practiceId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, practiceId }, select: { id: true } });
  if (!patient) return [];
  return prisma.medicalHistory.findMany({
    where: { patientId },
    include: { completedBy: { select: { name: true } }, answers: true },
    orderBy: { completedAt: "desc" },
  });
}

export async function getClinicalHistory(
  practiceId: string,
  patientId: string,
  opts: { search?: string; practitionerId?: string } = {}
) {
  const where: Prisma.ClinicalNoteWhereInput = { practiceId, patientId };
  if (opts.practitionerId) where.practitionerId = opts.practitionerId;
  if (opts.search) where.content = { contains: opts.search, mode: "insensitive" };

  return prisma.clinicalNote.findMany({
    where,
    include: {
      practitioner: { select: { name: true } },
      appointment: { include: { appointmentType: true } },
      signedBy: { select: { name: true } },
      createdBy: { select: { name: true } },
      amendments: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getClinicalNoteTemplates(practiceId: string, userId: string) {
  return prisma.clinicalNoteTemplate.findMany({
    where: { practiceId, active: true, OR: [{ ownerUserId: null }, { ownerUserId: userId }] },
    orderBy: { title: "asc" },
  });
}

export async function getPatientNotes(practiceId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, practiceId }, select: { id: true } });
  if (!patient) return [];
  return prisma.patientNote.findMany({
    where: { patientId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPatientDocuments(practiceId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, practiceId }, select: { id: true } });
  if (!patient) return [];
  return prisma.patientDocument.findMany({
    where: { patientId, deletedAt: null },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function getPatientTasks(practiceId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, practiceId }, select: { id: true } });
  if (!patient) return [];
  return prisma.patientTask.findMany({
    where: { patientId, practiceId },
    include: { assignedTo: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
}

export async function getPatientFamily(practiceId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, practiceId }, select: { id: true } });
  if (!patient) return [];

  const [from, to] = await Promise.all([
    prisma.patientFamilyRelationship.findMany({
      where: { patientId },
      include: { relatedPatient: { select: { id: true, firstName: true, lastName: true, patientCode: true } } },
    }),
    prisma.patientFamilyRelationship.findMany({
      where: { relatedPatientId: patientId },
      include: { patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } } },
    }),
  ]);

  const fromSide = from
    .filter((r) => r.relatedPatient) // guard against cross-practice edge cases
    .map((r) => ({
      relationshipId: r.id,
      relationType: r.relationType,
      patient: r.relatedPatient,
    }));
  const toSide = to.map((r) => ({
    relationshipId: r.id,
    relationType: reciprocalRelation(r.relationType),
    patient: r.patient,
  }));

  return [...fromSide, ...toSide];
}

export async function searchPatientsFull(
  practiceId: string,
  query: string,
  opts: { includeArchived?: boolean } = {}
) {
  const q = query.trim();

  const digitsOnly = q.replace(/[^0-9]/g, "");
  const asDate = /^\d{4}-\d{2}-\d{2}$/.test(q) ? new Date(q) : null;
  const words = q.split(/\s+/).filter(Boolean);

  const nameCondition: Prisma.PatientWhereInput = {
    AND: words.map((word) => ({
      OR: [
        { firstName: { contains: word, mode: "insensitive" as const } },
        { lastName: { contains: word, mode: "insensitive" as const } },
      ],
    })),
  };

  const where: Prisma.PatientWhereInput = {
    practiceId,
    ...(opts.includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    ...(q.length > 0
      ? {
          OR: [
            nameCondition,
            { patientCode: { contains: q, mode: "insensitive" } },
            ...(digitsOnly.length >= 3 ? [{ phone: { contains: digitsOnly } }] : []),
            ...(asDate ? [{ dateOfBirth: asDate }] : []),
          ],
        }
      : {}),
  };

  const patients = await prisma.patient.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 50,
  });

  const alertsByPatient = await prisma.medicalAlert.findMany({
    where: { patientId: { in: patients.map((p) => p.id) }, active: true },
  });
  const alertMap = new Map<string, number>();
  for (const alert of alertsByPatient) {
    alertMap.set(alert.patientId, (alertMap.get(alert.patientId) ?? 0) + 1);
  }

  return patients.map((p) => ({ ...p, activeAlertCount: alertMap.get(p.id) ?? 0 }));
}
