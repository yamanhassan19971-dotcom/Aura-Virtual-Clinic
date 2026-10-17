import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import {
  bookConsultation,
  createLead,
  logContact,
  markLost,
  markThinking,
  reopenLead,
  scheduleCall,
} from "@/lib/services/lead-service";
import { completeFollowUp, createFollowUp, skipFollowUp } from "@/lib/services/follow-up-service";
import { cancelAppointment, changeStatus, createAppointment, markFta, updateAppointment } from "@/lib/services/appointment-service";
import { addPlanItem, changePlanStatus, completePlanItem, createPlan } from "@/lib/services/billing-service";
import { avoidClosedDay, bookingReminders, nextCallAttempt, postOpFollowUps } from "@/lib/followups/schedule";
import { followUpMessage } from "@/lib/followups/templates";
import { toWhatsAppNumber, whatsAppLink } from "@/lib/followups/whatsapp";
import { median, weekKpis, weekStartOf } from "@/lib/services/kpi-queries";
import { listFollowUps, withMessages } from "@/lib/services/pipeline-queries";
import { PermissionError } from "@/lib/permissions";
import { InvalidTransitionError } from "@/lib/services/errors";
import type { FollowUpKind } from "@prisma/client";

async function fixture() {
  await resetDb();
  return seedFixture();
}

function inDays(days: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  // Keep test appointments off Friday, the clinic's day off.
  if (d.getDay() === 5) d.setDate(d.getDate() + 1);
  return d;
}

function lead(overrides: Record<string, unknown> = {}) {
  return { name: "Abu Ahmad", phone: "0930 111 222", source: "FACEBOOK_AD", interest: "IMPLANTS", ...overrides };
}

describe("follow-up timetable", () => {
  it("books a confirmation now, a reminder the evening before and one 3 hours before", () => {
    const now = new Date(2026, 9, 12, 12); // Monday noon
    const start = new Date(2026, 9, 14, 18); // Wednesday 6pm
    const plan = bookingReminders(start, now);
    expect(plan.map((p) => p.kind)).toEqual(["CONFIRM_BOOKING", "REMIND_DAY_BEFORE", "REMIND_3H"]);
    expect(plan[1].dueAt).toEqual(new Date(2026, 9, 13, 18));
    expect(plan[2].dueAt).toEqual(new Date(2026, 9, 14, 15));
  });

  it("drops reminders that are already in the past for a same-day booking", () => {
    const now = new Date(2026, 9, 14, 16);
    const plan = bookingReminders(new Date(2026, 9, 14, 18), now);
    expect(plan.map((p) => p.kind)).toEqual(["CONFIRM_BOOKING"]);
  });

  it("sends the morning reminder at opening time instead of before it", () => {
    const now = new Date(2026, 9, 12, 12);
    const plan = bookingReminders(new Date(2026, 9, 14, 11), now);
    expect(plan.find((p) => p.kind === "REMIND_3H")!.dueAt).toEqual(new Date(2026, 9, 14, 10));
  });

  it("never schedules work on Friday: the day-before reminder for Saturday goes out Thursday", () => {
    const now = new Date(2026, 9, 12, 12);
    const saturday = new Date(2026, 9, 17, 12);
    const plan = bookingReminders(saturday, now);
    const dayBefore = plan.find((p) => p.kind === "REMIND_DAY_BEFORE")!.dueAt;
    expect(dayBefore.getDay()).toBe(4);
    expect(avoidClosedDay(new Date(2026, 9, 16, 11)).getDay()).toBe(6);
  });

  it("follows up after a procedure the same evening, next day and later that week", () => {
    const plan = postOpFollowUps(new Date(2026, 9, 12, 14));
    expect(plan.map((p) => p.kind)).toEqual(["POST_OP_EVENING", "POST_OP_NEXT_DAY", "POST_OP_WEEK"]);
    expect(plan[0].dueAt).toEqual(new Date(2026, 9, 12, 19));
    expect(plan[1].dueAt).toEqual(new Date(2026, 9, 13, 11));
  });

  it("retries a missed call after an hour, then the next day at a different time", () => {
    const now = new Date(2026, 9, 12, 12);
    expect(nextCallAttempt(now, 1)).toEqual(new Date(2026, 9, 12, 13));
    expect(nextCallAttempt(now, 2)).toEqual(new Date(2026, 9, 13, 17));
  });
});

describe("messages", () => {
  it("normalises Syrian numbers for WhatsApp", () => {
    expect(toWhatsAppNumber("0930 513 950")).toBe("963930513950");
    expect(toWhatsAppNumber("+963 930 513 950")).toBe("963930513950");
    expect(toWhatsAppNumber("00963930513950")).toBe("963930513950");
    expect(toWhatsAppNumber("930513950")).toBe("963930513950");
    expect(toWhatsAppNumber("123")).toBeNull();
    expect(whatsAppLink("0930513950", "أهلاً")).toBe("https://wa.me/963930513950?text=%D8%A3%D9%87%D9%84%D8%A7%D9%8B");
  });

  it("fills the booking confirmation from the appointment", () => {
    const text = followUpMessage("CONFIRM_BOOKING", {
      patientName: "أبو أحمد",
      doctorName: "د. وجيه",
      startTime: new Date(2026, 9, 15, 18),
      isConsultation: true,
    });
    expect(text).toContain("أهلاً أبو أحمد");
    expect(text).toContain("د. وجيه");
    expect(text).toContain("الخميس 15/10");
    expect(text).toContain("6 مساءً");
    expect(text).toContain("الاستشارة مجانية");
  });
});

describe("enquiry pipeline", () => {
  it("logs an enquiry with a sequential number and tracks the first reply", async () => {
    const { actors } = await fixture();
    const a = await createLead(actors.reception, lead());
    const b = await createLead(actors.reception, lead({ name: "Um Sami", replied: true }));
    expect(a.leadNumber).toBe("L-000001");
    expect(b.leadNumber).toBe("L-000002");
    expect(a.stage).toBe("NEW");
    expect(a.firstReplyAt).toBeNull();
    expect(b.firstReplyAt).not.toBeNull();
    await expect(createLead(actors.clinicianA, lead())).rejects.toBeInstanceOf(PermissionError);
  });

  it("books a call, retries no-answers, parks 'thinking', and closes as lost", async () => {
    const { actors } = await fixture();
    const l = await createLead(actors.reception, lead());
    const callAt = inDays(1, 18);
    const booked = await scheduleCall(actors.reception, { leadId: l.id, callAt });
    expect(booked.stage).toBe("CALL_BOOKED");
    expect(booked.firstReplyAt).not.toBeNull();

    const missed = await logContact(actors.reception, { leadId: l.id, outcome: "NO_ANSWER" });
    expect(missed.callAttempts).toBe(1);
    expect(missed.callAt!.getTime()).toBeGreaterThan(Date.now());

    const thinking = await markThinking(actors.reception, { leadId: l.id, followUpAt: inDays(3, 12), note: "Wants to ask his wife" });
    expect(thinking.stage).toBe("THINKING");

    const lost = await markLost(actors.reception, { leadId: l.id, reason: "PRICE" });
    expect(lost.stage).toBe("LOST");
    expect(lost.closedAt).not.toBeNull();
    await expect(markThinking(actors.reception, { leadId: l.id, followUpAt: inDays(1, 12) })).rejects.toBeInstanceOf(
      InvalidTransitionError
    );

    const reopened = await reopenLead(actors.reception, { leadId: l.id });
    expect(reopened.stage).toBe("THINKING");
    const kinds = (await prisma.leadActivity.findMany({ where: { leadId: l.id }, orderBy: { createdAt: "asc" } })).map(
      (a) => a.kind
    );
    expect(kinds).toEqual(["CREATED", "CALL_BOOKED", "CALL_NO_ANSWER", "THINKING", "LOST", "REOPENED"]);
  });

  it("books the free consultation: creates the patient file, the appointment and its reminders", async () => {
    const { actors, drA, roomA, examType } = await fixture();
    const l = await createLead(actors.reception, lead({ keyWords: "Scared of pain" }));
    const startTime = inDays(3, 18);
    const { lead: booked, appointment } = await bookConsultation(actors.reception, {
      leadId: l.id,
      firstName: "Ahmad",
      lastName: "Khalil",
      dateOfBirth: "1975-01-01",
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: startTime.toISOString(),
      durationMin: 30,
    });
    expect(booked.stage).toBe("CONSULT_BOOKED");
    expect(booked.patientId).toBe(appointment.patientId);
    expect(appointment.status).toBe("CONFIRMED");
    expect(appointment.notes).toContain("Scared of pain");
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: appointment.patientId } });
    expect(patient.phone).toBe("0930 111 222");
    expect(patient.acquisitionSource).toBe("FACEBOOK_AD");

    const reminders = await prisma.followUp.findMany({ where: { appointmentId: appointment.id }, orderBy: { dueAt: "asc" } });
    expect(reminders.map((r) => r.kind)).toEqual(["CONFIRM_BOOKING", "REMIND_DAY_BEFORE", "REMIND_3H"]);

    // Arriving closes the enquiry as attended and drops the unsent reminders.
    await changeStatus(actors.reception, { appointmentId: appointment.id, status: "ARRIVED" });
    const attended = await prisma.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(attended.stage).toBe("ATTENDED");
    const open = await prisma.followUp.count({ where: { appointmentId: appointment.id, status: "DUE" } });
    expect(open).toBe(0);
  });

  it("sends a missed consultation back to the caller instead of a separate rebook task", async () => {
    const { actors, drA, roomA, examType, patient1 } = await fixture();
    const l = await createLead(actors.reception, lead());
    const { appointment } = await bookConsultation(actors.reception, {
      leadId: l.id,
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: inDays(2, 12).toISOString(),
      durationMin: 30,
    });
    await markFta(actors.reception, { appointmentId: appointment.id, reason: "DID_NOT_ATTEND" });
    const back = await prisma.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(back.stage).toBe("THINKING");
    expect(await prisma.followUp.count({ where: { appointmentId: appointment.id, kind: "REBOOK_MISSED" } })).toBe(0);
  });
});

describe("automatic follow-ups", () => {
  it("re-times reminders when an appointment moves and skips them when it is cancelled", async () => {
    const { actors, drA, roomA, examType, patient1 } = await fixture();
    const appt = await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: inDays(3, 18),
      durationMin: 30,
    });
    const newStart = inDays(5, 14);
    await updateAppointment(actors.reception, { appointmentId: appt.id, startTime: newStart });
    const threeH = await prisma.followUp.findFirstOrThrow({ where: { appointmentId: appt.id, kind: "REMIND_3H" } });
    expect(threeH.dueAt).toEqual(new Date(newStart.getTime() - 3 * 3600_000));

    await cancelAppointment(actors.reception, { appointmentId: appt.id, reason: "PATIENT_CANCELLED" });
    expect(await prisma.followUp.count({ where: { appointmentId: appt.id, status: "DUE" } })).toBe(0);
  });

  it("asks the caller to rebook a no-show", async () => {
    const { actors, drA, roomA, examType, patient1 } = await fixture();
    const appt = await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: inDays(1, 12),
      durationMin: 30,
    });
    await markFta(actors.reception, { appointmentId: appt.id, reason: "DID_NOT_ATTEND" });
    const rebook = await prisma.followUp.findFirstOrThrow({ where: { appointmentId: appt.id, kind: "REBOOK_MISSED" } });
    expect(rebook.channel).toBe("CALL");
    expect(rebook.status).toBe("DUE");
  });

  it("schedules post-op check-ins only for procedure appointment types", async () => {
    const { actors, drA, roomA, examType, patient1, practice } = await fixture();
    const surgery = await prisma.appointmentType.create({
      data: { practiceId: practice.id, name: "Implant Surgery", defaultDurationMin: 90, postOpFollowUp: true },
    });
    const book = (typeId: string, day: number) =>
      createAppointment(actors.reception, {
        patientId: patient1.id,
        practitionerId: drA.id,
        roomId: roomA.id,
        appointmentTypeId: typeId,
        startTime: inDays(day, 11),
        durationMin: 30,
      });
    const exam = await book(examType.id, 1);
    const op = await book(surgery.id, 2);
    await changeStatus(actors.reception, { appointmentId: exam.id, status: "COMPLETED" });
    await changeStatus(actors.reception, { appointmentId: op.id, status: "COMPLETED" });
    const postOpKinds = { in: ["POST_OP_EVENING", "POST_OP_NEXT_DAY", "POST_OP_WEEK"] as FollowUpKind[] };
    expect(await prisma.followUp.count({ where: { appointmentId: exam.id, kind: postOpKinds } })).toBe(0);
    const postOp = await prisma.followUp.findMany({ where: { appointmentId: op.id, kind: postOpKinds } });
    expect(postOp).toHaveLength(3);
    expect(postOp.find((f) => f.kind === "POST_OP_NEXT_DAY")!.channel).toBe("CALL");
  });

  it("follows a presented plan up after 3 days, and drops it once the patient decides", async () => {
    const { actors, patient1 } = await fixture();
    const plan = await createPlan(actors.clinicianA, { patientId: patient1.id, title: "Implant" });
    await addPlanItem(actors.clinicianA, { planId: plan.id, description: "Implant", quantity: 1, unitPriceCents: 20_000 });
    await changePlanStatus(actors.clinicianA, { planId: plan.id, action: "present" });
    const decision = await prisma.followUp.findFirstOrThrow({ where: { planId: plan.id, kind: "PLAN_DECISION" } });
    expect(decision.status).toBe("DUE");
    expect(decision.dueAt.getTime()).toBeGreaterThan(Date.now() + 2 * 86400_000);
    await changePlanStatus(actors.reception, { planId: plan.id, action: "accept" });
    const after = await prisma.followUp.findUniqueOrThrow({ where: { id: decision.id } });
    expect(after.status).toBe("SKIPPED");
  });

  it("asks for satisfaction when a plan completes, then a review only from a 9 or 10", async () => {
    const { actors, patient1, patient2 } = await fixture();
    async function finish(patientId: string) {
      const plan = await createPlan(actors.clinicianA, { patientId, title: "Filling" });
      const item = await addPlanItem(actors.clinicianA, { planId: plan.id, description: "Filling", quantity: 1, unitPriceCents: 3_000 });
      await changePlanStatus(actors.clinicianA, { planId: plan.id, action: "present" });
      await changePlanStatus(actors.reception, { planId: plan.id, action: "accept" });
      await completePlanItem(actors.clinicianA, { itemId: item.id });
      return plan;
    }
    const happy = await finish(patient1.id);
    const unhappy = await finish(patient2.id);
    const sat = (planId: string) => prisma.followUp.findFirstOrThrow({ where: { planId, kind: "SATISFACTION" } });
    expect(await prisma.followUp.count({ where: { patientId: patient1.id, kind: "RECALL", status: "DUE" } })).toBe(1);

    await expect(completeFollowUp(actors.reception, { followUpId: (await sat(happy.id)).id })).rejects.toEqual(
      expect.objectContaining({ code: "SCORE_REQUIRED" })
    );
    await completeFollowUp(actors.reception, { followUpId: (await sat(happy.id)).id, satisfactionScore: 10 });
    await completeFollowUp(actors.reception, { followUpId: (await sat(unhappy.id)).id, satisfactionScore: 6, outcome: "Waited too long" });
    expect(await prisma.followUp.count({ where: { patientId: patient1.id, kind: "REVIEW_REQUEST" } })).toBe(1);
    expect(await prisma.followUp.count({ where: { patientId: patient2.id, kind: "REVIEW_REQUEST" } })).toBe(0);
  });

  it("lets staff add, skip and list follow-ups with a ready WhatsApp link", async () => {
    const { actors, patient1 } = await fixture();
    const f = await createFollowUp(actors.reception, {
      patientId: patient1.id,
      channel: "CALL",
      dueAt: new Date(),
      note: "Ask about the X-ray from the radiology centre",
    });
    const rows = withMessages(await listFollowUps(actors.reception.practiceId, "today"), "Rana");
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain("X-ray");
    expect(rows[0].whatsAppUrl).toMatch(/^https:\/\/wa\.me\/963900000001\?text=/);
    await skipFollowUp(actors.reception, { followUpId: f.id, outcome: "Patient came in" });
    await expect(skipFollowUp(actors.reception, { followUpId: f.id })).rejects.toBeInstanceOf(InvalidTransitionError);
    await expect(createFollowUp(actors.clinicianA, { patientId: patient1.id, channel: "CALL", dueAt: new Date(), note: "x" })).rejects.toBeInstanceOf(PermissionError);
  });
});

describe("weekly numbers", () => {
  it("starts the week on Saturday and takes a proper median", () => {
    expect(weekStartOf(new Date(2026, 9, 14)).getDay()).toBe(6);
    expect(weekStartOf(new Date(2026, 9, 17, 15))).toEqual(new Date(2026, 9, 17));
    expect(median([7, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("measures reply speed and the enquiry-to-booking funnel", async () => {
    const { actors, drA, roomA, examType } = await fixture();
    const now = new Date();
    await createLead(actors.reception, lead({ firstMessageAt: new Date(now.getTime() - 4 * 60000), replied: true }));
    const b = await createLead(actors.reception, lead({ name: "B", firstMessageAt: new Date(now.getTime() - 20 * 60000), replied: true }));
    await createLead(actors.reception, lead({ name: "C" }));
    await scheduleCall(actors.reception, { leadId: b.id, callAt: inDays(1, 18) });
    await bookConsultation(actors.reception, {
      leadId: b.id,
      firstName: "B",
      lastName: "B",
      dateOfBirth: "1980-01-01",
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: inDays(2, 12).toISOString(),
      durationMin: 30,
    });
    const k = await weekKpis(actors.reception.practiceId, now);
    expect(k.newLeads).toBe(3);
    expect(k.medianReplyMinutes).toBeCloseTo(12, 0);
    expect(k.repliedWithinTarget).toBeCloseTo(1 / 3);
    expect(k.leadToCall).toBeCloseTo(1 / 3);
    expect(k.callToConsult).toBe(1);
  });
});
