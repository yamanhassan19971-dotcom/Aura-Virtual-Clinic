import { auth } from "@/lib/auth";
import { listAllPractitioners } from "@/lib/services/settings-service";
import { listRooms } from "@/lib/services/queries";
import { ClinicianTable } from "@/components/settings/ClinicianTable";

export default async function CliniciansSettingsPage() {
  const session = await auth();
  const practiceId = session!.user.practiceId;
  const [practitioners, rooms] = await Promise.all([listAllPractitioners(practiceId), listRooms(practiceId)]);
  return <ClinicianTable practitioners={practitioners} rooms={rooms} />;
}
