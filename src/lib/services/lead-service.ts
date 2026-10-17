import type { LeadActivityKind, LeadStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nextCallAttempt } from "@/lib/followups/schedule";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { createAppointmentInTx } from "@/lib/services/appointment-service";
import { serialize, writeAudit } from "@/lib/services/audit";
import { InvalidTransitionError, NotFoundError } from "@/lib/services/errors";
import { createPatientInTx } from "@/lib/services/patient-service";
import {
  bookConsultationSchema,
  createLeadSchema,
  leadRefSchema,
  logLeadContactSchema,
  markLostSchema,
  markThinkingSchema,
  scheduleCallSchema,
  updateLeadSchema,
} from "@/lib/validation/pipeline";

// The enquiry pipeline from AURA's patient-journey playbook: the WhatsApp
// agent logs the enquiry and replies within 5 minutes, books a call slot and
// hands over the story; the caller books the free consultation; reception
// sees them arrive. Every change writes a LeadActivity (the timeline staff
// read) and an AuditLog row, in the same transaction.

type Tx = Prisma.TransactionClient;

const OPEN_STAGES: LeadStage[] = ["NEW", "CALL_BOOKED", "THINKING"];

async function nextLeadNumber(tx: Tx): Promise<string> {
  const last = await tx.lead.findFirst({ orderBy: { leadNumber: "desc" }, select: { leadNumber: true } });
  const lastNumber = last ? parseInt(last.leadNumber.replace(/\D/g, ""), 10) : 0;
  return `L-${String(lastNumber + 1).padStart(6, "0")}`;
}

async function loadLead(tx: Tx, practiceId: string, leadId: string) {
  const lead = await tx.lead.findFirst({ where: { id: leadId, practiceId } });
  if (!lead) throw new NotFoundError("Enquiry not found");
  return lead;
}

function assertOpen(stage: LeadStage, target: string) {
  if (!OPEN_STAGES.includes(stage)) throw new InvalidTransitionError(stage, target);
}

async function record(
  tx: Tx,
  actor: Actor,
  leadId: string,
  kind: LeadActivityKind,
  note: string | null | undefined,
  audit: { previous: unknown; next: unknown }
) {
  await tx.leadActivity.create({ data: { leadId, kind, note: note || null, createdById: actor.id } });
  await writeAudit(tx, {
    userId: actor.id,
    action: `lead.${kind.toLowerCase()}`,
    recordType: "Lead",
    recordId: leadId,
    previousValue: audit.previous,
    newValue: audit.next,
  });
}

export async function createLead(actor: Actor, rawInput: unknown) {
  const input = createLeadSchema.parse(rawInput);
  assertCan(actor.role, "leads.manage");
  const now = new Date();
  const firstMessageAt = input.firstMessageAt && input.firstMessageAt < now ? input.firstMessageAt : now;

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        practiceId: actor.practiceId,
        leadNumber: await nextLeadNumber(tx),
        name: input.name,
        phone: input.phone,
        source: input.source,
        sourceNote: input.sourceNote || null,
        interest: input.interest,
        forWhom: input.forWhom || null,
        location: input.location || null,
        keyWords: input.keyWords || null,
        toldSoFar: input.toldSoFar || null,
        firstMessageAt,
        firstReplyAt: input.replied ? now : null,
        stage: input.callAt ? "CALL_BOOKED" : "NEW",
        callAt: input.callAt ?? null,
        callBookedAt: input.callAt ? now : null,
        assignedToUserId: actor.id,
        createdById: actor.id,
      },
    });
    await record(tx, actor, lead.id, "CREATED", null, { previous: null, next: serialize(lead) });
    if (input.replied) await tx.leadActivity.create({ data: { leadId: lead.id, kind: "REPLIED", createdById: actor.id } });
    if (input.callAt) {
      await tx.leadActivity.create({ data: { leadId: lead.id, kind: "CALL_BOOKED", createdById: actor.id } });
    }
    return lead;
  });
}

export async function updateLead(actor: Actor, rawInput: unknown) {
  const input = updateLeadSchema.parse(rawInput);
  assertCan(actor.role, "leads.manage");
  return prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, actor.practiceId, input.leadId);
    const { leadId, ...fields } = input;
    const data: Prisma.LeadUpdateInput = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) (data as Record<string, unknown>)[key] = value === "" ? null : value;
    }
    const updated = await tx.lead.update({ where: { id: leadId }, data });
    await writeAudit(tx, {
      userId: actor.id,
      action: "lead.edited",
      recordType: "Lead",
      recordId: lead.id,
      previousValue: serialize(lead),
      newValue: serialize(updated),
    });
    return updated;
  });
}

/** The first human reply went out (the 5-minute speed-to-lead clock stops). */
export async function markReplied(actor: Actor, rawInput: unknown) {
  const input = leadRefSchema.parse(rawInput);
  assertCan(actor.role, "leads.manage");
  return prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, actor.practiceId, input.leadId);
    if (lead.firstReplyAt) return lead;
    const updated = await tx.lead.update({ where: { id: lead.id }, data: { firstReplyAt: new Date() } });
    await record(tx, actor, lead.id, "REPLIED", input.note, { previous: null, next: { firstReplyAt: updated.firstReplyAt } });
    return updated;
  });
}

export async function scheduleCall(actor: Actor, rawInput: unknown) {
  const input = scheduleCallSchema.parse(rawInput);
  assertCan(actor.role, "leads.manage");
  return prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, actor.practiceId, input.leadId);
    assertOpen(lead.stage, "CALL_BOOKED");
    const now = new Date();
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: {
        stage: "CALL_BOOKED",
        callAt: input.callAt,
        callBookedAt: lead.callBookedAt ?? now,
        // Booking a call slot is itself a reply.
        firstReplyAt: lead.firstReplyAt ?? now,
      },
    });
    await record(tx, actor, lead.id, "CALL_BOOKED", input.note, {
      previous: { stage: lead.stage, callAt: lead.callAt },
      next: { stage: updated.stage, callAt: updated.callAt },
    });
    return updated;
  });
}

/**
 * Logs a call attempt or message. "No answer" schedules the next attempt
 * the playbook's way: an hour later, then the next day at another time.
 */
export async function logContact(actor: Actor, rawInput: unknown) {
  const input = logLeadContactSchema.parse(rawInput);
  assertCan(actor.role, "leads.manage");
  return prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, actor.practiceId, input.leadId);
    const now = new Date();
    const data: Prisma.LeadUpdateInput = {};
    let kind: LeadActivityKind = "NOTE";
    if (input.outcome === "NO_ANSWER") {
      assertOpen(lead.stage, "CALL_NO_ANSWER");
      kind = "CALL_NO_ANSWER";
      data.callAttempts = lead.callAttempts + 1;
      data.callAt = nextCallAttempt(now, lead.callAttempts + 1);
      if (lead.stage === "NEW") {
        data.stage = "CALL_BOOKED";
        data.callBookedAt = lead.callBookedAt ?? now;
      }
    } else if (input.outcome === "REACHED") {
      kind = "CALL_REACHED";
      data.callAttempts = lead.callAttempts + 1;
    } else if (input.outcome === "WHATSAPP_SENT") {
      kind = "WHATSAPP_SENT";
      if (!lead.firstReplyAt) data.firstReplyAt = now;
    }
    const updated = Object.keys(data).length ? await tx.lead.update({ where: { id: lead.id }, data }) : lead;
    await record(tx, actor, lead.id, kind, input.note, {
      previous: { callAttempts: lead.callAttempts, callAt: lead.callAt },
      next: { callAttempts: updated.callAttempts, callAt: updated.callAt },
    });
    return updated;
  });
}

/** "I'll think about it": never push, agree a specific follow-up time instead. */
export async function markThinking(actor: Actor, rawInput: unknown) {
  const input = markThinkingSchema.parse(rawInput);
  assertCan(actor.role, "leads.manage");
  return prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, actor.practiceId, input.leadId);
    assertOpen(lead.stage, "THINKING");
    const now = new Date();
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: { stage: "THINKING", callAt: input.followUpAt, firstReplyAt: lead.firstReplyAt ?? now },
    });
    await record(tx, actor, lead.id, "THINKING", input.note, {
      previous: { stage: lead.stage },
      next: { stage: "THINKING", callAt: input.followUpAt },
    });
    return updated;
  });
}

export async function markLost(actor: Actor, rawInput: unknown) {
  const input = markLostSchema.parse(rawInput);
  assertCan(actor.role, "leads.manage");
  return prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, actor.practiceId, input.leadId);
    assertOpen(lead.stage, "LOST");
    const now = new Date();
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: { stage: "LOST", lostReason: input.reason, callAt: null, closedAt: now },
    });
    await record(tx, actor, lead.id, "LOST", input.note, {
      previous: { stage: lead.stage },
      next: { stage: "LOST", lostReason: input.reason },
    });
    return updated;
  });
}

export async function reopenLead(actor: Actor, rawInput: unknown) {
  const input = leadRefSchema.parse(rawInput);
  assertCan(actor.role, "leads.manage");
  return prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, actor.practiceId, input.leadId);
    if (lead.stage !== "LOST") throw new InvalidTransitionError(lead.stage, "REOPENED");
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: { stage: "THINKING", lostReason: null, closedAt: null, callAt: new Date() },
    });
    await record(tx, actor, lead.id, "REOPENED", input.note, { previous: { stage: "LOST" }, next: { stage: "THINKING" } });
    return updated;
  });
}

/**
 * Books the free consultation: links (or creates) the patient file and books
 * the appointment, which schedules the confirmation and reminders. One
 * transaction, so a conflict leaves no half-created patient behind.
 */
export async function bookConsultation(actor: Actor, rawInput: unknown) {
  const input = bookConsultationSchema.parse(rawInput);
  assertCan(actor.role, "leads.manage");
  return prisma.$transaction(async (tx) => {
    const lead = await loadLead(tx, actor.practiceId, input.leadId);
    assertOpen(lead.stage, "CONSULT_BOOKED");

    let patientId = input.patientId ?? lead.patientId;
    if (patientId) {
      const patient = await tx.patient.findFirst({ where: { id: patientId, practiceId: actor.practiceId } });
      if (!patient) throw new NotFoundError("Patient not found");
    } else {
      assertCan(actor.role, "patients.create");
      const patient = await createPatientInTx(tx, actor, {
        firstName: input.firstName!,
        lastName: input.lastName!,
        dateOfBirth: input.dateOfBirth!,
        phone: lead.phone,
        acquisitionSource: lead.source,
      });
      patientId = patient.id;
    }

    const appointment = await createAppointmentInTx(tx, actor, {
      patientId,
      practitionerId: input.practitionerId,
      roomId: input.roomId,
      appointmentTypeId: input.appointmentTypeId,
      startTime: input.startTime,
      durationMin: input.durationMin,
      status: "CONFIRMED",
      notes: [lead.keyWords, lead.forWhom].filter(Boolean).join(" · ") || null,
      overrideConflict: input.overrideConflict,
    });

    const now = new Date();
    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: {
        stage: "CONSULT_BOOKED",
        patientId,
        consultAppointmentId: appointment.id,
        consultBookedAt: now,
        callAt: null,
        firstReplyAt: lead.firstReplyAt ?? now,
        callBookedAt: lead.callBookedAt ?? now,
      },
    });
    await record(tx, actor, lead.id, "CONSULT_BOOKED", null, {
      previous: { stage: lead.stage },
      next: { stage: "CONSULT_BOOKED", appointmentId: appointment.id, patientId },
    });
    return { lead: updated, appointment };
  });
}
