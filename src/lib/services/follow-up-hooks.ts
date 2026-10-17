import type { Appointment, FollowUpKind, Prisma, TreatmentPlanStatus } from "@prisma/client";
import {
  BOOKING_REMINDER_KINDS,
  FOLLOW_UP_CHANNEL,
  bookingReminders,
  planDecisionDue,
  postOpFollowUps,
  recallDue,
  satisfactionDue,
  type PlannedFollowUp,
} from "@/lib/followups/schedule";

// Called from inside the appointment and billing services' transactions, so
// the follow-up list always matches what happened to the appointment or plan.
// No permission checks here: the calling service has already checked them.

type Tx = Prisma.TransactionClient;

type Origin = {
  practiceId: string;
  patientId: string;
  appointmentId?: string | null;
  planId?: string | null;
  createdById?: string | null;
};

async function create(tx: Tx, origin: Origin, planned: PlannedFollowUp[]) {
  if (planned.length === 0) return;
  await tx.followUp.createMany({
    data: planned.map((p) => ({
      practiceId: origin.practiceId,
      patientId: origin.patientId,
      appointmentId: origin.appointmentId ?? null,
      planId: origin.planId ?? null,
      kind: p.kind,
      channel: FOLLOW_UP_CHANNEL[p.kind],
      dueAt: p.dueAt,
      createdById: origin.createdById ?? null,
    })),
  });
}

async function skipOpen(tx: Tx, where: Prisma.FollowUpWhereInput, outcome: string) {
  await tx.followUp.updateMany({
    where: { ...where, status: "DUE" },
    data: { status: "SKIPPED", outcome, completedAt: new Date() },
  });
}

/** Booking confirmation + day-before + 3-hour reminders for a new appointment. */
export async function onAppointmentBooked(tx: Tx, appt: Appointment, actorId: string, now = new Date()) {
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") return;
  await create(
    tx,
    { practiceId: appt.practiceId, patientId: appt.patientId, appointmentId: appt.id, createdById: actorId },
    bookingReminders(appt.startTime, now)
  );
}

/** The appointment moved: re-time its reminders that haven't been sent yet. */
export async function onAppointmentRescheduled(tx: Tx, appt: Appointment, now = new Date()) {
  const open = await tx.followUp.findMany({
    where: { appointmentId: appt.id, status: "DUE", kind: { in: BOOKING_REMINDER_KINDS } },
  });
  const plan = new Map(bookingReminders(appt.startTime, now).map((p) => [p.kind, p.dueAt]));
  for (const f of open) {
    const dueAt = f.kind === "CONFIRM_BOOKING" ? now : plan.get(f.kind);
    if (dueAt) {
      await tx.followUp.update({ where: { id: f.id }, data: { dueAt } });
    } else {
      await tx.followUp.update({
        where: { id: f.id },
        data: { status: "SKIPPED", outcome: "Appointment moved too close for this reminder", completedAt: now },
      });
    }
  }
  // A moved appointment deserves a fresh confirmation with the new time.
  if (!open.some((f) => f.kind === "CONFIRM_BOOKING")) {
    await create(tx, { practiceId: appt.practiceId, patientId: appt.patientId, appointmentId: appt.id }, [
      { kind: "CONFIRM_BOOKING", dueAt: now },
    ]);
  }
}

export async function onAppointmentCancelled(tx: Tx, appt: Appointment) {
  await skipOpen(tx, { appointmentId: appt.id, kind: { in: BOOKING_REMINDER_KINDS } }, "Appointment cancelled");
  await leadConsultationMissed(tx, appt, "cancelled");
}

/** A no-show: stop the reminders and ask the caller to rebook, warmly and with a concrete new slot. */
export async function onAppointmentMissed(tx: Tx, appt: Appointment, actorId: string, now = new Date()) {
  await skipOpen(tx, { appointmentId: appt.id, kind: { in: BOOKING_REMINDER_KINDS } }, "Patient did not attend");
  const handledByLead = await leadConsultationMissed(tx, appt, "missed");
  if (!handledByLead) {
    await create(
      tx,
      { practiceId: appt.practiceId, patientId: appt.patientId, appointmentId: appt.id, createdById: actorId },
      [{ kind: "REBOOK_MISSED", dueAt: now }]
    );
  }
}

/** Arrived / in surgery / completed. */
export async function onAppointmentProgressed(
  tx: Tx,
  appt: Appointment & { appointmentType: { postOpFollowUp: boolean } },
  actorId: string,
  now = new Date()
) {
  await skipOpen(tx, { appointmentId: appt.id, kind: { in: BOOKING_REMINDER_KINDS } }, "Patient arrived");

  const lead = await tx.lead.findFirst({ where: { consultAppointmentId: appt.id, stage: "CONSULT_BOOKED" } });
  if (lead) {
    await tx.lead.update({ where: { id: lead.id }, data: { stage: "ATTENDED", attendedAt: now, closedAt: now } });
    await tx.leadActivity.create({ data: { leadId: lead.id, kind: "ATTENDED", createdById: actorId } });
  }

  if (appt.status === "COMPLETED" && appt.appointmentType.postOpFollowUp) {
    const already = await tx.followUp.count({ where: { appointmentId: appt.id, kind: "POST_OP_EVENING" } });
    if (already === 0) {
      await create(
        tx,
        { practiceId: appt.practiceId, patientId: appt.patientId, appointmentId: appt.id, createdById: actorId },
        postOpFollowUps(appt.completedAt ?? now)
      );
    }
  }
}

/**
 * The free consultation booked from an enquiry was cancelled or missed: the
 * enquiry goes back to "thinking" with a call due now, so the caller rebooks
 * it from the enquiry (which keeps the patient's story).
 */
async function leadConsultationMissed(tx: Tx, appt: Appointment, what: "missed" | "cancelled"): Promise<boolean> {
  const lead = await tx.lead.findFirst({ where: { consultAppointmentId: appt.id, stage: "CONSULT_BOOKED" } });
  if (!lead) return false;
  const now = new Date();
  await tx.lead.update({ where: { id: lead.id }, data: { stage: "THINKING", callAt: now } });
  await tx.leadActivity.create({
    data: { leadId: lead.id, kind: "THINKING", note: what === "missed" ? "Missed the consultation" : "Consultation cancelled" },
  });
  return true;
}

/** Plan presented -> decision call in 3 days; decided -> drop it; completed -> satisfaction call and recall. */
export async function onPlanStatusChanged(
  tx: Tx,
  plan: { id: string; practiceId: string; patientId: string },
  status: TreatmentPlanStatus,
  actorId: string,
  now = new Date()
) {
  const origin = { practiceId: plan.practiceId, patientId: plan.patientId, planId: plan.id, createdById: actorId };
  if (status === "PRESENTED") {
    await skipOpen(tx, { planId: plan.id, kind: "PLAN_DECISION" }, "Plan presented again");
    await create(tx, origin, [{ kind: "PLAN_DECISION", dueAt: planDecisionDue(now) }]);
    return;
  }
  if (status === "ACCEPTED" || status === "DECLINED" || status === "CANCELLED") {
    await skipOpen(tx, { planId: plan.id, kind: "PLAN_DECISION" }, `Plan ${status.toLowerCase()}`);
  }
  if (status === "COMPLETED") {
    const planned: PlannedFollowUp[] = [{ kind: "SATISFACTION", dueAt: satisfactionDue(now) }];
    const recallOpen = await tx.followUp.count({
      where: { patientId: plan.patientId, kind: "RECALL", status: "DUE" },
    });
    if (recallOpen === 0) planned.push({ kind: "RECALL", dueAt: recallDue(now) });
    await create(tx, origin, planned);
  }
}

/** A satisfied patient (9-10) gets the Google review request straight away. */
export async function scheduleReviewRequest(
  tx: Tx,
  origin: Origin,
  now = new Date()
) {
  const kind: FollowUpKind = "REVIEW_REQUEST";
  const existing = await tx.followUp.count({ where: { patientId: origin.patientId, kind, planId: origin.planId ?? null } });
  if (existing === 0) await create(tx, origin, [{ kind, dueAt: now }]);
}
