import { notFound } from "next/navigation";
import { requireActor } from "@/lib/actions/action-result";
import { can } from "@/lib/permissions";
import { listPractitionerLinks, listStaff } from "@/lib/services/staff-service";
import { StaffTable } from "@/components/settings/StaffTable";

export default async function StaffSettingsPage() {
  const actor = await requireActor();
  if (!can(actor.role, "users.manage")) notFound();
  const [staff, practitioners] = await Promise.all([listStaff(actor), listPractitionerLinks(actor)]);
  return <StaffTable staff={staff} practitioners={practitioners} currentUserId={actor.id} now={new Date()} />;
}
