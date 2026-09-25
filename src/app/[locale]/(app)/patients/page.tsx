import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { searchPatientsFull } from "@/lib/services/patient-queries";
import { PatientListPanel } from "@/components/patient/list/PatientListPanel";

export default async function PatientsPage() {
  const session = await auth();
  const initialResults = await searchPatientsFull(session!.user.practiceId, "");

  return <PatientListPanel initialResults={initialResults} canCreate={can(session!.user.role, "patients.create")} />;
}
