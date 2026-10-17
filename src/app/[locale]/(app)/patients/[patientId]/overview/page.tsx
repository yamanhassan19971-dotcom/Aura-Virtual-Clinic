import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientOverview } from "@/lib/services/patient-queries";
import { getPatientFollowUps, withMessages } from "@/lib/services/pipeline-queries";
import { OverviewPanel } from "@/components/patient/overview/OverviewPanel";
import { PatientFollowUps } from "@/components/pipeline/PatientFollowUps";

export default async function PatientOverviewPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const session = await auth();
  const role = session!.user.role;
  const overview = await getPatientOverview(session!.user.practiceId, patientId);
  const canViewClinical = can(role, "patients.viewClinical");
  const now = new Date();
  const followUps = can(role, "followUps.view")
    ? withMessages(await getPatientFollowUps(session!.user.practiceId, patientId), session!.user.name, now)
    : null;
  return (
    <>
      <OverviewPanel overview={overview} patientId={patientId} canViewClinical={canViewClinical} />
      {followUps && (
        <div className="px-6 pb-6">
          <PatientFollowUps
            patientId={patientId}
            items={followUps}
            canManage={can(role, "followUps.manage")}
            nowIso={now.toISOString()}
          />
        </div>
      )}
    </>
  );
}
