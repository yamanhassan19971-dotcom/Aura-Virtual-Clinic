import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientNotes } from "@/lib/services/patient-queries";
import { PatientNotesPanel } from "@/components/patient/notes/PatientNotesPanel";

export default async function PatientNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { patientId } = await params;
  const { new: openNew } = await searchParams;
  const session = await auth();

  const notes = await getPatientNotes(session!.user.practiceId, patientId);

  return (
    <PatientNotesPanel
      patientId={patientId}
      notes={notes}
      canManage={can(session!.user.role, "patients.manageAdminNotes")}
      currentUserName={session!.user.name}
      startOpen={openNew === "1"}
    />
  );
}
