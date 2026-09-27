import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { readDocumentFile } from "@/lib/documents/storage";

// Private clinical-image streaming endpoint, gated by patients.viewClinical
// rather than patients.view — mirrors /api/documents/[documentId] but a
// Receptionist (who can view general documents) must not be able to reach
// clinical images/radiographs by guessing this URL either.
export async function GET(_req: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!can(session.user.role, "patients.viewClinical")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { imageId } = await params;
  const image = await prisma.clinicalImage.findFirst({
    where: { id: imageId, deletedAt: null },
    include: { patient: { select: { practiceId: true } } },
  });

  if (!image || image.patient.practiceId !== session.user.practiceId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await readDocumentFile(image.storageKey);
  const isPreviewable = image.mimeType === "application/pdf" || image.mimeType.startsWith("image/");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Disposition": `${isPreviewable ? "inline" : "attachment"}; filename="${encodeURIComponent(image.filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
