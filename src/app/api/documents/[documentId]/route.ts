import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { readDocumentFile } from "@/lib/documents/storage";

// Private document streaming endpoint — never a public/static URL. Every
// request re-checks the session, the practice boundary and the permission,
// so a document link can't be shared/guessed across practices.
export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!can(session.user.role, "patients.view")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { documentId } = await params;
  const document = await prisma.patientDocument.findFirst({
    where: { id: documentId, deletedAt: null },
    include: { patient: { select: { practiceId: true } } },
  });

  if (!document || document.patient.practiceId !== session.user.practiceId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await readDocumentFile(document.storageKey);
  const isPreviewable = document.mimeType === "application/pdf" || document.mimeType.startsWith("image/");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `${isPreviewable ? "inline" : "attachment"}; filename="${encodeURIComponent(document.filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
