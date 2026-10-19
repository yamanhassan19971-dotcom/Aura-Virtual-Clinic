import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { LeadStage } from "@prisma/client";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getLeadBoard, type LeadCard } from "@/lib/services/pipeline-queries";
import { LeadBoard, type LeadCardView } from "@/components/pipeline/LeadBoard";

function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

function toView(lead: LeadCard, now: Date): LeadCardView {
  return {
    id: lead.id,
    leadNumber: lead.leadNumber,
    name: lead.name,
    phone: lead.phone,
    source: lead.source,
    interest: lead.interest,
    forWhom: lead.forWhom,
    location: lead.location,
    stage: lead.stage,
    lostReason: lead.lostReason,
    waitingMinutes: lead.firstReplyAt ? null : minutesBetween(lead.firstMessageAt, now),
    replyMinutes: lead.firstReplyAt ? minutesBetween(lead.firstMessageAt, lead.firstReplyAt) : null,
    callAt: lead.callAt?.toISOString() ?? null,
    callDue: !!lead.callAt && lead.callAt <= now,
    callAttempts: lead.callAttempts,
    consultAt: lead.consultAppointment?.startTime.toISOString() ?? null,
    consultDoctor: lead.consultAppointment?.practitioner.name ?? null,
  };
}

// The enquiry board: the WhatsApp agent's and caller's home screen.
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const session = await auth();
  if (!can(session!.user.role, "leads.view")) notFound();
  const t = await getTranslations("pipeline.leads");
  const now = new Date();
  const board = await getLeadBoard(session!.user.practiceId, { q: q?.trim() || undefined });
  const columns = Object.fromEntries(
    Object.entries(board).map(([stage, leads]) => [stage, leads.map((l) => toView(l, now))])
  ) as Record<LeadStage, LeadCardView[]>;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] bg-white px-4 md:px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </div>
      <div className="p-4 md:p-6">
        <LeadBoard
          columns={columns}
          nowIso={now.toISOString()}
          canManage={can(session!.user.role, "leads.manage")}
          initialQuery={q ?? ""}
        />
      </div>
    </div>
  );
}
