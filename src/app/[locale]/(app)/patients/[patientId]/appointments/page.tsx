import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getPatientAppointments, getPatientHeader } from "@/lib/services/patient-queries";
import { listAppointmentTypes, listPractitioners, listRooms } from "@/lib/services/queries";
import { AppointmentsPanel } from "@/components/patient/appointments/AppointmentsPanel";

export default async function PatientAppointmentsPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const session = await auth();
  const practiceId = session!.user.practiceId;

  const [{ upcoming, past }, header, practitioners, rooms, appointmentTypes] = await Promise.all([
    getPatientAppointments(practiceId, patientId),
    getPatientHeader(practiceId, patientId),
    listPractitioners(practiceId),
    listRooms(practiceId),
    listAppointmentTypes(practiceId),
  ]);

  if (!header) return null;

  return (
    <AppointmentsPanel
      patient={header.patient}
      upcoming={upcoming}
      past={past}
      practitioners={practitioners}
      rooms={rooms}
      appointmentTypes={appointmentTypes}
      canBook={can(session!.user.role, "appointments.create")}
      currentUserRole={session!.user.role}
    />
  );
}
