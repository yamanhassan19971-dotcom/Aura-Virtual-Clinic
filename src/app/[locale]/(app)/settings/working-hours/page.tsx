import { auth } from "@/lib/auth";
import { listAllWorkingHours } from "@/lib/services/settings-service";
import { WorkingHoursTable } from "@/components/settings/WorkingHoursTable";

export default async function WorkingHoursSettingsPage() {
  const session = await auth();
  const workingHours = await listAllWorkingHours(session!.user.practiceId);
  return <WorkingHoursTable workingHours={workingHours} />;
}
