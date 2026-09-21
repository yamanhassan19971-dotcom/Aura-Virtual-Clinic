import { auth } from "@/lib/auth";
import { parseDateParam } from "@/lib/time";
import {
  getAppointmentsForDay,
  listAppointmentTypes,
  listPractitioners,
  listRooms,
  listWorkingHours,
} from "@/lib/services/queries";
import { DiaryWorkspace } from "@/components/diary/DiaryWorkspace";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  const { date: dateParam } = await searchParams;
  const date = parseDateParam(dateParam);

  const practiceId = session!.user.practiceId;

  const [appointments, practitioners, rooms, appointmentTypes, workingHours] = await Promise.all([
    getAppointmentsForDay(practiceId, date),
    listPractitioners(practiceId),
    listRooms(practiceId),
    listAppointmentTypes(practiceId),
    listWorkingHours(practiceId),
  ]);

  return (
    <DiaryWorkspace
      key={date.toISOString()}
      date={date}
      appointments={appointments}
      practitioners={practitioners}
      rooms={rooms}
      appointmentTypes={appointmentTypes}
      workingHours={workingHours}
      currentUser={{
        id: session!.user.id,
        role: session!.user.role,
        practitionerId: session!.user.practitionerId,
      }}
    />
  );
}
