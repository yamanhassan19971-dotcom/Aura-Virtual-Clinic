import { auth } from "@/lib/auth";
import { listAllAppointmentTypes } from "@/lib/services/settings-service";
import { AppointmentTypeTable } from "@/components/settings/AppointmentTypeTable";

export default async function AppointmentTypesSettingsPage() {
  const session = await auth();
  const appointmentTypes = await listAllAppointmentTypes(session!.user.practiceId);
  return <AppointmentTypeTable appointmentTypes={appointmentTypes} />;
}
