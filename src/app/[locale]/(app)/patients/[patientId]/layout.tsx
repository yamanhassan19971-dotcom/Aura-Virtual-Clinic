import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientHeader } from "@/lib/services/patient-queries";
import { listAppointmentTypes, listPractitioners, listRooms } from "@/lib/services/queries";
import { PatientHeaderBar } from "@/components/patient/PatientHeaderBar";
import { PatientTabs } from "@/components/patient/PatientTabs";

// Note: Next.js layouts never receive `searchParams` (only `page.tsx`
// does) — the "current appointment" banner and "Back to Diary" return-date
// are read client-side (useSearchParams) inside PatientHeaderBar/PatientTabs
// instead, so they still work here despite living in the layout.
export default async function PatientRecordLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const session = await auth();
  const practiceId = session!.user.practiceId;

  const [header, practitioners, rooms, appointmentTypes] = await Promise.all([
    getPatientHeader(practiceId, patientId),
    listPractitioners(practiceId),
    listRooms(practiceId),
    listAppointmentTypes(practiceId),
  ]);

  if (!header) notFound();

  const canViewClinical = can(session!.user.role, "patients.viewClinical");

  return (
    <div className="flex h-full flex-col">
      <PatientHeaderBar
        patient={header.patient}
        // Receptionist has full demographic/administrative access but no
        // clinical access — medical alerts never cross into this client
        // component's props for that role, not just hidden after the fact.
        alerts={canViewClinical ? header.alerts : []}
        flags={header.flags}
        practitioners={practitioners}
        rooms={rooms}
        appointmentTypes={appointmentTypes}
        currentUserRole={session!.user.role}
      />
      <PatientTabs patientId={patientId} canViewClinical={canViewClinical} />
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
