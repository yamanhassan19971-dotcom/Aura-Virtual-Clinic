import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinicalImages } from "@/lib/services/patient-queries";
import { ImagesPanel } from "@/components/patient/images/ImagesPanel";

export default async function PatientImagesPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const session = await auth();

  // Clinical images/radiographs are gated the same way as Chart/Medical/
  // History — a Receptionist has no clinical access to this tab at all.
  if (!can(session!.user.role, "patients.viewClinical")) notFound();

  const images = await getClinicalImages(session!.user.practiceId, patientId);

  return (
    <ImagesPanel
      patientId={patientId}
      images={images}
      canManage={can(session!.user.role, "patients.manageClinicalImages")}
      currentUserName={session!.user.name}
    />
  );
}
