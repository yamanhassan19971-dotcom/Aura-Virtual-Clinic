import type { LeadSource } from "@prisma/client";
import { prisma } from "@/lib/db";

// The six weekly numbers from the patient-journey playbook, reviewed in the
// 15-minute weekly meeting. Each one shows where the journey leaks: fast
// replies but few bookings -> the call; many bookings but few attending ->
// the reminders. AURA's week starts on Saturday (Friday is the day off).

export const WEEK_START_DAY = 6; // Saturday
export const REPLY_TARGET_MINUTES = 5;
export const ATTENDANCE_TARGET = 0.85;

export function weekStartOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const back = (d.getDay() - WEEK_START_DAY + 7) % 7;
  d.setDate(d.getDate() - back);
  return d;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function rate(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

export type WeekKpis = {
  weekStart: string;
  newLeads: number;
  medianReplyMinutes: number | null;
  repliedWithinTarget: number | null;
  leadToCall: number | null;
  callToConsult: number | null;
  attendance: number | null;
  attended: number;
  missed: number;
  acceptance: number | null;
  accepted: number;
  declined: number;
  reviewsRequested: number;
  averageSatisfaction: number | null;
};

export async function weekKpis(practiceId: string, weekStart: Date): Promise<WeekKpis> {
  const from = weekStartOf(weekStart);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  const inWeek = { gte: from, lt: to };

  const [leads, appointments, accepted, declined, reviews, satisfaction] = await Promise.all([
    prisma.lead.findMany({
      where: { practiceId, firstMessageAt: inWeek },
      select: { firstMessageAt: true, firstReplyAt: true, callBookedAt: true, consultBookedAt: true },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { practiceId, startTime: inWeek, status: { in: ["ARRIVED", "IN_SURGERY", "COMPLETED", "FTA"] } },
      _count: true,
    }),
    prisma.treatmentPlan.count({ where: { practiceId, acceptedAt: inWeek } }),
    prisma.treatmentPlan.count({ where: { practiceId, declinedAt: inWeek } }),
    prisma.followUp.count({ where: { practiceId, kind: "REVIEW_REQUEST", status: "DONE", completedAt: inWeek } }),
    prisma.followUp.aggregate({
      where: { practiceId, kind: "SATISFACTION", status: "DONE", completedAt: inWeek },
      _avg: { satisfactionScore: true },
    }),
  ]);

  const replyMinutes = leads
    .filter((l) => l.firstReplyAt)
    .map((l) => Math.max(0, (l.firstReplyAt!.getTime() - l.firstMessageAt.getTime()) / 60000));
  const withCall = leads.filter((l) => l.callBookedAt);
  const missed = appointments.find((a) => a.status === "FTA")?._count ?? 0;
  const attended = appointments.filter((a) => a.status !== "FTA").reduce((s, a) => s + a._count, 0);

  return {
    weekStart: from.toISOString(),
    newLeads: leads.length,
    medianReplyMinutes: median(replyMinutes),
    repliedWithinTarget: rate(replyMinutes.filter((m) => m <= REPLY_TARGET_MINUTES).length, leads.length),
    leadToCall: rate(withCall.length, leads.length),
    callToConsult: rate(withCall.filter((l) => l.consultBookedAt).length, withCall.length),
    attendance: rate(attended, attended + missed),
    attended,
    missed,
    acceptance: rate(accepted, accepted + declined),
    accepted,
    declined,
    reviewsRequested: reviews,
    averageSatisfaction: satisfaction._avg.satisfactionScore,
  };
}

/** Where this week's enquiries came from, and why last month's were lost. */
export async function pipelineBreakdown(practiceId: string, weekStart: Date) {
  const from = weekStartOf(weekStart);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  const monthAgo = new Date(to.getTime() - 30 * 86400_000);
  const [sources, lost] = await Promise.all([
    prisma.lead.groupBy({ by: ["source"], where: { practiceId, firstMessageAt: { gte: from, lt: to } }, _count: true }),
    prisma.lead.groupBy({
      by: ["lostReason"],
      where: { practiceId, stage: "LOST", closedAt: { gte: monthAgo, lt: to } },
      _count: true,
    }),
  ]);
  return {
    sources: sources.map((s) => ({ source: s.source as LeadSource, count: s._count })).sort((a, b) => b.count - a.count),
    lostReasons: lost
      .map((l) => ({ reason: l.lostReason ?? "OTHER", count: l._count }))
      .sort((a, b) => b.count - a.count),
  };
}
