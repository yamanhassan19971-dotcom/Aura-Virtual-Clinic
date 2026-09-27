import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getBpeExams, getChartForPatient } from "@/lib/services/patient-queries";
import { listPractitioners } from "@/lib/services/queries";
import { ChartPanel } from "@/components/patient/chart/ChartPanel";

export default async function PatientChartPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const session = await auth();
  const practiceId = session!.user.practiceId;

  // Receptionist has full demographic/administrative access but no clinical
  // access — block direct navigation to this tab's URL, not just the UI
  // entry points into it.
  if (!can(session!.user.role, "patients.viewClinical")) notFound();

  const [entries, bpeExams, practitioners] = await Promise.all([
    getChartForPatient(practiceId, patientId),
    getBpeExams(practiceId, patientId),
    listPractitioners(practiceId),
  ]);

  return (
    <ChartPanel
      patientId={patientId}
      entries={entries}
      bpeExams={bpeExams}
      practitioners={practitioners}
      defaultPractitionerId={session!.user.practitionerId}
      canManageChart={can(session!.user.role, "patients.manageClinicalChart")}
      canManageBpe={can(session!.user.role, "patients.manageBpe")}
    />
  );
}
