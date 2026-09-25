import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getMedicalHistoryList, getPatientHeader } from "@/lib/services/patient-queries";
import { MedicalPanel } from "@/components/patient/medical/MedicalPanel";

export default async function PatientMedicalPage({
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

  const [histories, header] = await Promise.all([
    getMedicalHistoryList(practiceId, patientId),
    getPatientHeader(practiceId, patientId),
  ]);

  return (
    <MedicalPanel
      patientId={patientId}
      histories={histories}
      alerts={header?.alerts ?? []}
      canManageHistory={can(session!.user.role, "patients.manageMedicalHistory")}
      canManageAlerts={can(session!.user.role, "patients.manageAlerts")}
      startOpen={openNew === "1"}
    />
  );
}
