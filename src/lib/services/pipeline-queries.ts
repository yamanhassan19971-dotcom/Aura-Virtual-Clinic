import type { FollowUpStatus, LeadStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { followUpMessage, type MessageContext } from "@/lib/followups/templates";
import { telLink, whatsAppLink } from "@/lib/followups/whatsapp";

// Read side of the Phase 5 pipeline: the enquiry board, one enquiry's
// handoff card and timeline, and the follow-up list with ready-made messages.

export const OPEN_LEAD_STAGES: LeadStage[] = ["NEW", "CALL_BOOKED", "THINKING", "CONSULT_BOOKED"];
const CLOSED_LOOKBACK_DAYS = 30;

const LEAD_CARD_SELECT = {
  id: true,
  leadNumber: true,
  name: true,
  phone: true,
  source: true,
  interest: true,
  forWhom: true,
  location: true,
  stage: true,
  lostReason: true,
  firstMessageAt: true,
  firstReplyAt: true,
  callAt: true,
  callAttempts: true,
  closedAt: true,
  consultAppointment: { select: { startTime: true, practitioner: { select: { name: true } } } },
} satisfies Prisma.LeadSelect;

export type LeadCard = Prisma.LeadGetPayload<{ select: typeof LEAD_CARD_SELECT }>;

function searchWhere(q?: string): Prisma.LeadWhereInput {
  if (!q) return {};
  const digits = q.replace(/\D/g, "");
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { leadNumber: { contains: q, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ],
  };
}

/** Open enquiries by stage, plus the last 30 days of closed ones (attended / not interested). */
export async function getLeadBoard(practiceId: string, opts: { q?: string } = {}) {
  const since = new Date(Date.now() - CLOSED_LOOKBACK_DAYS * 86400_000);
  const leads = await prisma.lead.findMany({
    where: {
      practiceId,
      AND: [searchWhere(opts.q), { OR: [{ stage: { in: OPEN_LEAD_STAGES } }, { closedAt: { gte: since } }] }],
    },
    select: LEAD_CARD_SELECT,
    orderBy: [{ callAt: "asc" }, { firstMessageAt: "asc" }],
  });
  const byStage: Record<LeadStage, LeadCard[]> = {
    NEW: [],
    CALL_BOOKED: [],
    THINKING: [],
    CONSULT_BOOKED: [],
    ATTENDED: [],
    LOST: [],
  };
  for (const lead of leads) byStage[lead.stage].push(lead);
  // Closed columns read newest first.
  byStage.ATTENDED.sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));
  byStage.LOST.sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));
  return byStage;
}

export async function getLead(practiceId: string, leadId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, practiceId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
      consultAppointment: {
        select: {
          id: true,
          startTime: true,
          status: true,
          practitioner: { select: { name: true } },
          appointmentType: { select: { name: true } },
        },
      },
      assignedTo: { select: { name: true } },
      activities: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } },
    },
  });
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLead>>>;

/** Existing patients with the same phone number, so a returning patient isn't filed twice. */
export async function findPatientsByPhone(practiceId: string, phone: string) {
  const digits = phone.replace(/\D/g, "");
  const tail = digits.slice(-8);
  if (tail.length < 6) return [];
  return prisma.patient.findMany({
    where: { practiceId, status: { not: "ARCHIVED" }, phone: { contains: tail } },
    select: { id: true, firstName: true, lastName: true, patientCode: true, dateOfBirth: true, phone: true },
    take: 5,
  });
}

// --- Follow-ups -------------------------------------------------------------

const FOLLOW_UP_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, preferredName: true, patientCode: true, phone: true } },
  appointment: {
    select: {
      startTime: true,
      practitioner: { select: { name: true, nameAr: true } },
      appointmentType: { select: { name: true } },
      consultForLeads: { select: { id: true } },
    },
  },
  plan: { select: { planNumber: true, title: true, practitioner: { select: { name: true, nameAr: true } } } },
  completedBy: { select: { name: true } },
} satisfies Prisma.FollowUpInclude;

type FollowUpRow = Prisma.FollowUpGetPayload<{ include: typeof FOLLOW_UP_INCLUDE }>;

export type FollowUpView = "today" | "upcoming" | "done";

function endOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function listFollowUps(practiceId: string, view: FollowUpView, now = new Date()) {
  const eod = endOfToday(now);
  let where: Prisma.FollowUpWhereInput;
  let orderBy: Prisma.FollowUpOrderByWithRelationInput = { dueAt: "asc" };
  if (view === "today") {
    where = { practiceId, status: "DUE", dueAt: { lte: eod } };
  } else if (view === "upcoming") {
    where = { practiceId, status: "DUE", dueAt: { gt: eod, lte: new Date(eod.getTime() + 14 * 86400_000) } };
  } else {
    where = {
      practiceId,
      status: { in: ["DONE", "SKIPPED"] as FollowUpStatus[] },
      completedAt: { gte: new Date(now.getTime() - 7 * 86400_000) },
    };
    orderBy = { completedAt: "desc" };
  }
  return prisma.followUp.findMany({ where, include: FOLLOW_UP_INCLUDE, orderBy, take: 300 });
}

export async function countFollowUpsDue(practiceId: string, now = new Date()) {
  return prisma.followUp.count({ where: { practiceId, status: "DUE", dueAt: { lte: endOfToday(now) } } });
}

export async function getPatientFollowUps(practiceId: string, patientId: string) {
  return prisma.followUp.findMany({
    where: { practiceId, patientId },
    include: FOLLOW_UP_INCLUDE,
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 100,
  });
}

function doctorForPatients(p: { name: string; nameAr: string | null } | null): string | null {
  return p ? p.nameAr || p.name : null;
}

/** Adds the patient-facing message and one-tap WhatsApp/phone links to each row. */
export function withMessages(rows: FollowUpRow[], staffName: string | null, now = new Date()) {
  return rows.map((row) => {
    const patientName = row.patient.preferredName || row.patient.firstName;
    const ctx: MessageContext = {
      patientName,
      staffName,
      doctorName: doctorForPatients(row.appointment?.practitioner ?? row.plan?.practitioner ?? null),
      startTime: row.appointment?.startTime ?? null,
      isConsultation:
        !!row.appointment &&
        (row.appointment.consultForLeads.length > 0 || /consult/i.test(row.appointment.appointmentType.name)),
    };
    const message = row.kind === "CUSTOM" ? row.note ?? "" : followUpMessage(row.kind, ctx);
    const waText = row.kind === "CUSTOM" ? followUpMessage("CUSTOM", ctx) : message;
    return {
      id: row.id,
      kind: row.kind,
      channel: row.channel,
      status: row.status,
      dueAt: row.dueAt.toISOString(),
      overdue: row.status === "DUE" && row.dueAt < now && row.dueAt.toDateString() !== now.toDateString(),
      note: row.note,
      outcome: row.outcome,
      satisfactionScore: row.satisfactionScore,
      completedAt: row.completedAt?.toISOString() ?? null,
      completedBy: row.completedBy?.name ?? null,
      patient: {
        id: row.patient.id,
        name: `${row.patient.firstName} ${row.patient.lastName}`,
        code: row.patient.patientCode,
        phone: row.patient.phone,
      },
      context: row.appointment
        ? {
            kind: "appointment" as const,
            appointmentAt: row.appointment.startTime.toISOString(),
            doctor: row.appointment.practitioner.name,
            type: row.appointment.appointmentType.name,
          }
        : row.plan
          ? { kind: "plan" as const, planNumber: row.plan.planNumber, planTitle: row.plan.title }
          : null,
      message,
      whatsAppUrl: whatsAppLink(row.patient.phone, waText),
      telUrl: telLink(row.patient.phone),
    };
  });
}

export type FollowUpItem = ReturnType<typeof withMessages>[number];
