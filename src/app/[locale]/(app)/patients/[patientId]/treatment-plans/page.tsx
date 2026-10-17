import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientPlans, listCatalogItems } from "@/lib/services/billing-queries";
import { listPractitioners } from "@/lib/services/queries";
import { TreatmentPlansPanel } from "@/components/billing/TreatmentPlansPanel";

export default async function PatientTreatmentPlansPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const session = await auth();
  const { practiceId, role, practitionerId } = session!.user;

  const [plans, catalog, practitioners] = await Promise.all([
    getPatientPlans(practiceId, patientId),
    listCatalogItems(practiceId, { activeOnly: true }),
    listPractitioners(practiceId),
  ]);

  return (
    <TreatmentPlansPanel
      patientId={patientId}
      plans={plans}
      catalog={catalog}
      practitioners={practitioners.map((p) => ({ id: p.id, name: p.name }))}
      defaultPractitionerId={practitionerId}
      permissions={{
        canManage: can(role, "treatmentPlans.manage"),
        canDecide: can(role, "treatmentPlans.recordDecision"),
        canTakePayment: can(role, "payments.record"),
      }}
    />
  );
}
