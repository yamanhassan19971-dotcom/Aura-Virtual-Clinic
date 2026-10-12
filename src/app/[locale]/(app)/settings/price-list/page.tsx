import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listCatalogItems } from "@/lib/services/billing-queries";
import { PriceListTable } from "@/components/settings/PriceListTable";

export default async function PriceListSettingsPage() {
  const session = await auth();
  const items = await listCatalogItems(session!.user.practiceId);
  return <PriceListTable items={items} canManage={can(session!.user.role, "settings.manage")} />;
}
