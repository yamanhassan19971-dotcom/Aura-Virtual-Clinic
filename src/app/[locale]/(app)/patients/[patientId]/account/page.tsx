import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientAccount } from "@/lib/services/billing-queries";
import { AccountPanel } from "@/components/billing/AccountPanel";

export default async function PatientAccountPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const session = await auth();
  const { practiceId, role } = session!.user;

  const account = await getPatientAccount(practiceId, patientId);

  return (
    <AccountPanel
      patientId={patientId}
      account={account}
      permissions={{
        canRecord: can(role, "payments.record"),
        canVoid: can(role, "payments.void"),
        canRequestRefund: can(role, "refunds.request"),
        canProcessRefund: can(role, "refunds.process"),
      }}
    />
  );
}
