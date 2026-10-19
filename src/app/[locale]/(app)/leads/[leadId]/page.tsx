import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { leadMessage, type LeadMessageKind } from "@/lib/followups/templates";
import { telLink, whatsAppLink } from "@/lib/followups/whatsapp";
import { findPatientsByPhone, getLead } from "@/lib/services/pipeline-queries";
import { listAppointmentTypes, listPractitioners, listRooms } from "@/lib/services/queries";
import { LeadDetailPanel, type LeadDetailView } from "@/components/pipeline/LeadDetailPanel";

const MESSAGE_ORDER: Record<string, LeadMessageKind[]> = {
  NEW: ["FIRST_REPLY", "OFFER_CALL", "NO_REPLY_2H", "OUT_OF_HOURS"],
  CALL_BOOKED: ["MISSED_CALL", "OFFER_CALL", "NO_REPLY_2H"],
  THINKING: ["MISSED_CALL", "OFFER_CALL", "NO_REPLY_2H"],
};

export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const session = await auth();
  if (!can(session!.user.role, "leads.view")) notFound();
  const practiceId = session!.user.practiceId;
  const lead = await getLead(practiceId, leadId);
  if (!lead) notFound();
  const t = await getTranslations("pipeline.leads");

  const [practitioners, rooms, types, matches] = await Promise.all([
    listPractitioners(practiceId),
    listRooms(practiceId),
    listAppointmentTypes(practiceId),
    lead.patientId ? Promise.resolve([]) : findPatientsByPhone(practiceId, lead.phone),
  ]);

  const view: LeadDetailView = {
    id: lead.id,
    leadNumber: lead.leadNumber,
    name: lead.name,
    phone: lead.phone,
    source: lead.source,
    sourceNote: lead.sourceNote,
    interest: lead.interest,
    forWhom: lead.forWhom,
    location: lead.location,
    keyWords: lead.keyWords,
    toldSoFar: lead.toldSoFar,
    stage: lead.stage,
    lostReason: lead.lostReason,
    firstMessageAt: lead.firstMessageAt.toISOString(),
    firstReplyAt: lead.firstReplyAt?.toISOString() ?? null,
    callAt: lead.callAt?.toISOString() ?? null,
    callAttempts: lead.callAttempts,
    assignedTo: lead.assignedTo?.name ?? null,
    patient: lead.patient
      ? { id: lead.patient.id, name: `${lead.patient.firstName} ${lead.patient.lastName}`, code: lead.patient.patientCode }
      : null,
    consultation: lead.consultAppointment
      ? {
          startTime: lead.consultAppointment.startTime.toISOString(),
          doctor: lead.consultAppointment.practitioner.name,
          type: lead.consultAppointment.appointmentType.name,
          status: lead.consultAppointment.status,
        }
      : null,
    activities: lead.activities.map((a) => ({
      id: a.id,
      kind: a.kind,
      note: a.note,
      at: a.createdAt.toISOString(),
      by: a.createdBy?.name ?? null,
    })),
  };

  const ctx = { patientName: lead.name, staffName: session!.user.name, interest: lead.interest };
  const messages = (MESSAGE_ORDER[lead.stage] ?? []).map((kind) => {
    const text = leadMessage(kind, ctx);
    return { kind, text, whatsAppUrl: whatsAppLink(lead.phone, text) };
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] bg-white px-4 md:px-6 py-4">
        <Link href="/leads" className="text-xs text-[var(--color-blue)] hover:underline">
          ‹ {t("back")}
        </Link>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">
          {lead.name} <span className="text-sm font-normal text-gray-400" dir="ltr">{lead.leadNumber}</span>
        </h1>
      </div>
      <div className="p-4 md:p-6">
        <LeadDetailPanel
          lead={view}
          messages={messages}
          telUrl={telLink(lead.phone)}
          canManage={can(session!.user.role, "leads.manage")}
          nowIso={new Date().toISOString()}
          booking={{
            practitioners: practitioners.map((p) => ({ id: p.id, name: p.name, defaultRoomId: p.defaultRoomId })),
            rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
            types: types.map((x) => ({ id: x.id, name: x.name, defaultDurationMin: x.defaultDurationMin })),
            matches: matches.map((p) => ({
              id: p.id,
              name: `${p.firstName} ${p.lastName}`,
              patientCode: p.patientCode,
              dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
            })),
          }}
        />
      </div>
    </div>
  );
}
