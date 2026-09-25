import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinicalHistory, getClinicalNoteTemplates } from "@/lib/services/patient-queries";
import { listPractitioners } from "@/lib/services/queries";
import { ClinicalHistoryPanel } from "@/components/patient/clinical/ClinicalHistoryPanel";

export default async function PatientClinicalHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { patientId } = await params;
  const { new: openNew } = await searchParams;
  const session = await auth();
  const practiceId = session!.user.practiceId;

  // Receptionist has full demographic/administrative access but no clinical
  // access — block direct navigation to this tab's URL, not just the UI
  // entry points into it.
  if (!can(session!.user.role, "patients.viewClinical")) notFound();

  const [notes, templates, practitioners] = await Promise.all([
    getClinicalHistory(practiceId, patientId),
    getClinicalNoteTemplates(practiceId, session!.user.id),
    listPractitioners(practiceId),
  ]);

  return (
    <ClinicalHistoryPanel
      patientId={patientId}
      notes={notes}
      templates={templates}
      practitioners={practitioners}
      defaultPractitionerId={session!.user.practitionerId}
      currentUserName={session!.user.name}
      canManageNotes={can(session!.user.role, "patients.manageClinicalNotes")}
      canManageTemplates={can(session!.user.role, "patients.manageNoteTemplates")}
      startOpen={openNew === "1"}
    />
  );
}
