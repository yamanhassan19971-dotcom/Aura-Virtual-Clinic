import { redirect } from "@/i18n/navigation";

export default async function PatientRootPage({
  params,
}: {
  params: Promise<{ locale: string; patientId: string }>;
}) {
  const { locale, patientId } = await params;
  redirect({ href: `/patients/${patientId}/overview`, locale });
}
