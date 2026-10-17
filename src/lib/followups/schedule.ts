import type { FollowUpChannel, FollowUpKind } from "@prisma/client";
import { CLOSED_WEEKDAYS } from "@/lib/billing/money";

// AURA's follow-up timetable, from the Phase 3 patient-journey playbook.
// Pure date arithmetic so it can be unit tested without a database.

export const FOLLOW_UP_CHANNEL: Record<FollowUpKind, FollowUpChannel> = {
  CONFIRM_BOOKING: "WHATSAPP",
  REMIND_DAY_BEFORE: "WHATSAPP",
  REMIND_3H: "WHATSAPP",
  POST_OP_EVENING: "WHATSAPP",
  POST_OP_NEXT_DAY: "CALL",
  POST_OP_WEEK: "WHATSAPP",
  PLAN_DECISION: "CALL",
  SATISFACTION: "CALL",
  REVIEW_REQUEST: "WHATSAPP",
  RECALL: "WHATSAPP",
  REBOOK_MISSED: "CALL",
  CUSTOM: "CALL",
};

/** Kinds that remind the patient about one appointment; they move when it moves. */
export const BOOKING_REMINDER_KINDS: FollowUpKind[] = ["CONFIRM_BOOKING", "REMIND_DAY_BEFORE", "REMIND_3H"];

export const OPEN_HOUR = 10;
export const CLOSE_HOUR = 20;
export const PLAN_DECISION_DAYS = 3;
export const RECALL_MONTHS = 6;
/** A 9 or 10 out of 10 earns a review request; anything lower is a "what could we do better?" conversation. */
export const REVIEW_MIN_SCORE = 9;

function at(day: Date, hour: number, minute = 0): Date {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isClosed(date: Date): boolean {
  return CLOSED_WEEKDAYS.includes(date.getDay());
}

/** Moves a due time off the closed day (Friday): forward to the next morning, or back to the previous evening. */
export function avoidClosedDay(date: Date, direction: "forward" | "back" = "forward"): Date {
  let d = new Date(date);
  while (isClosed(d)) {
    d = direction === "forward" ? at(addDays(d, 1), OPEN_HOUR) : at(addDays(d, -1), 18);
  }
  return d;
}

export type PlannedFollowUp = { kind: FollowUpKind; dueAt: Date };

/**
 * Booking reminders: a confirmation straight away, a friendly check the
 * evening before, and a short reminder three hours before. Reminders whose
 * time has already passed (e.g. a same-day booking) are dropped.
 */
export function bookingReminders(startTime: Date, now: Date): PlannedFollowUp[] {
  const out: PlannedFollowUp[] = [{ kind: "CONFIRM_BOOKING", dueAt: now }];
  const dayBefore = avoidClosedDay(at(addDays(startTime, -1), 18), "back");
  const threeHours = new Date(startTime.getTime() - 3 * 3600_000);
  if (dayBefore > now && dayBefore.toDateString() !== startTime.toDateString()) {
    out.push({ kind: "REMIND_DAY_BEFORE", dueAt: dayBefore });
  }
  if (threeHours > now) {
    // Before opening time, send it first thing in the morning instead.
    const opening = at(startTime, OPEN_HOUR);
    out.push({ kind: "REMIND_3H", dueAt: threeHours < opening && opening < startTime ? opening : threeHours });
  }
  return out;
}

/** After a procedure: WhatsApp the same evening, call the next day, WhatsApp again 3-7 days later. */
export function postOpFollowUps(completedAt: Date): PlannedFollowUp[] {
  const evening = completedAt.getHours() >= 19 ? new Date(completedAt.getTime() + 3600_000) : at(completedAt, 19);
  return [
    { kind: "POST_OP_EVENING", dueAt: evening },
    { kind: "POST_OP_NEXT_DAY", dueAt: avoidClosedDay(at(addDays(completedAt, 1), 11)) },
    { kind: "POST_OP_WEEK", dueAt: avoidClosedDay(at(addDays(completedAt, 4), 12)) },
  ];
}

export function planDecisionDue(presentedAt: Date): Date {
  return avoidClosedDay(at(addDays(presentedAt, PLAN_DECISION_DAYS), 12));
}

export function satisfactionDue(completedAt: Date): Date {
  return avoidClosedDay(at(addDays(completedAt, 1), 12));
}

export function recallDue(completedAt: Date, months = RECALL_MONTHS): Date {
  const d = new Date(completedAt);
  d.setMonth(d.getMonth() + months);
  return avoidClosedDay(at(d, 12));
}

/**
 * Leads: after a missed call the playbook retries an hour later, and the
 * third attempt is the next day at a different time of day.
 */
export function nextCallAttempt(now: Date, attemptsSoFar: number): Date {
  if (attemptsSoFar >= 2) {
    const otherTime = now.getHours() < 15 ? 17 : 11;
    return avoidClosedDay(at(addDays(now, 1), otherTime));
  }
  const next = new Date(now.getTime() + 3600_000);
  if (next.getHours() >= CLOSE_HOUR) return avoidClosedDay(at(addDays(now, 1), 12));
  return avoidClosedDay(next);
}
