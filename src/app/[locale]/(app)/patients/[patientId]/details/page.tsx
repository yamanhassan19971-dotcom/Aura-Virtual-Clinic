import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientFamily, getPatientHeader } from "@/lib/services/patient-queries";
import { listPractitioners } from "@/lib/services/queries";
import { DetailsForm } from "@/components/patient/details/DetailsForm";

export default async function PatientDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { patientId } = await params;
  const { edit } = await searchParams;
  const session = await auth();
  const practiceId = session!.user.practiceId;

  const [header, family, practitioners] = await Promise.all([
    getPatientHeader(practiceId, patientId),
    getPatientFamily(practiceId, patientId),
    listPractitioners(practiceId),
  ]);
  if (!header) return null;

  return (
    <DetailsForm
      patient={header.patient}
      family={family}
      practitioners={practitioners}
      startInEditMode={edit === "1"}
      canEdit={can(session!.user.role, "patients.editDemographics")}
      canManageFamily={can(session!.user.role, "patients.manageFamily")}
    />
  );
}
