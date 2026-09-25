import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientOverview } from "@/lib/services/patient-queries";
import { OverviewPanel } from "@/components/patient/overview/OverviewPanel";

export default async function PatientOverviewPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const session = await auth();
  const overview = await getPatientOverview(session!.user.practiceId, patientId);
  const canViewClinical = can(session!.user.role, "patients.viewClinical");
  return <OverviewPanel overview={overview} patientId={patientId} canViewClinical={canViewClinical} />;
}
