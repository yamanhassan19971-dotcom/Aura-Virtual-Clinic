import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APPOINTMENT_INCLUDE, type AppointmentWithRelations } from "@/lib/services/appointment-service";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getAppointmentsForDay(
  practiceId: string,
  date: Date,
  practitionerIds?: string[]
): Promise<AppointmentWithRelations[]> {
  return prisma.appointment.findMany({
    where: {
      practiceId,
      date: startOfDay(date),
      practitionerId: practitionerIds && practitionerIds.length > 0 ? { in: practitionerIds } : undefined,
    },
    include: APPOINTMENT_INCLUDE,
    orderBy: { startTime: "asc" },
  });
}

export async function getWaitingRoom(practiceId: string, date: Date): Promise<AppointmentWithRelations[]> {
  return prisma.appointment.findMany({
    where: { practiceId, date: startOfDay(date), status: "ARRIVED" },
    include: APPOINTMENT_INCLUDE,
    orderBy: { arrivedAt: "asc" },
  });
}

export async function getInSurgery(practiceId: string, date: Date): Promise<AppointmentWithRelations[]> {
  return prisma.appointment.findMany({
    where: { practiceId, date: startOfDay(date), status: "IN_SURGERY" },
    include: APPOINTMENT_INCLUDE,
    orderBy: { inSurgeryAt: "asc" },
  });
}

export async function getStatusSummary(
  practiceId: string,
  date: Date
): Promise<Record<AppointmentStatus, number> & { total: number }> {
  const rows = await prisma.appointment.groupBy({
    by: ["status"],
    where: { practiceId, date: startOfDay(date) },
    _count: { _all: true },
  });
  const base: Record<AppointmentStatus, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    ARRIVED: 0,
    IN_SURGERY: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    FTA: 0,
  };
  let total = 0;
  for (const row of rows) {
    base[row.status] = row._count._all;
    total += row._count._all;
  }
  return { ...base, total };
}

export async function listPractitioners(practiceId: string) {
  return prisma.practitioner.findMany({
    where: { practiceId, active: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listRooms(practiceId: string) {
  return prisma.room.findMany({ where: { practiceId, active: true }, orderBy: { name: "asc" } });
}

export async function listAppointmentTypes(practiceId: string) {
  return prisma.appointmentType.findMany({
    where: { practiceId, active: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listWorkingHours(practiceId: string) {
  return prisma.workingHours.findMany({ where: { practiceId, practitionerId: null }, orderBy: { weekday: "asc" } });
}

export async function listUsers(practiceId: string) {
  return prisma.user.findMany({
    where: { practiceId, active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function searchPatients(practiceId: string, query: string) {
  const q = query.trim();
  if (q.length === 0) return [];

  const digitsOnly = q.replace(/[^0-9]/g, "");
  const asDate = /^\d{4}-\d{2}-\d{2}$/.test(q) ? new Date(q) : null;

  // A full-name query ("Ahmed Hassan") needs every word matched across
  // first/last name, since firstName/lastName alone never contain the
  // whole string — a single-word query still falls out of this correctly.
  const words = q.split(/\s+/).filter(Boolean);
  const nameCondition: Prisma.PatientWhereInput = {
    AND: words.map((word) => ({
      OR: [
        { firstName: { contains: word, mode: "insensitive" as const } },
        { lastName: { contains: word, mode: "insensitive" as const } },
      ],
    })),
  };

  return prisma.patient.findMany({
    where: {
      practiceId,
      status: { not: "ARCHIVED" },
      OR: [
        nameCondition,
        { patientCode: { contains: q, mode: "insensitive" } },
        ...(digitsOnly.length >= 3 ? [{ phone: { contains: digitsOnly } }] : []),
        ...(asDate ? [{ dateOfBirth: asDate }] : []),
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 12,
  });
}

export async function getAppointmentById(practiceId: string, id: string): Promise<AppointmentWithRelations | null> {
  return prisma.appointment.findFirst({ where: { id, practiceId }, include: APPOINTMENT_INCLUDE });
}

export async function getStatusHistory(practiceId: string, appointmentId: string) {
  const appt = await prisma.appointment.findFirst({ where: { id: appointmentId, practiceId }, select: { id: true } });
  if (!appt) return [];
  return prisma.appointmentStatusHistory.findMany({
    where: { appointmentId },
    include: { changedBy: { select: { name: true } } },
    orderBy: { changedAt: "asc" },
  });
}
