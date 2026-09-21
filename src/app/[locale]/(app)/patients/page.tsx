import { getTranslations } from "next-intl/server";
import { Placeholder } from "@/components/shell/Placeholder";

export default async function PatientsPage() {
  const t = await getTranslations("nav");
  return <Placeholder label={t("patients")} />;
}
