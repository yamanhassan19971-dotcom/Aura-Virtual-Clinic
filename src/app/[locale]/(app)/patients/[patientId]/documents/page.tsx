import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientDocuments } from "@/lib/services/patient-queries";
import { DocumentsPanel } from "@/components/patient/documents/DocumentsPanel";

export default async function PatientDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ upload?: string }>;
}) {
  const { patientId } = await params;
  const { upload } = await searchParams;
  const session = await auth();

  const documents = await getPatientDocuments(session!.user.practiceId, patientId);

  return (
    <DocumentsPanel
      patientId={patientId}
      documents={documents}
      canManage={can(session!.user.role, "patients.manageDocuments")}
      currentUserName={session!.user.name}
      startOpen={upload === "1"}
    />
  );
}
