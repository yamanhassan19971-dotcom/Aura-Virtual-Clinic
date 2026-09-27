"use server";

import * as clinicalImageService from "@/lib/services/clinical-image-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function uploadClinicalImageAction(formData: FormData) {
  const actor = await requireActor();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false as const, kind: "VALIDATION" as const, message: "No file provided." };
  }

  const meta = {
    patientId: formData.get("patientId"),
    filename: file.name,
    category: formData.get("category") || "OTHER",
    toothNumber: formData.get("toothNumber") || null,
    chartEntryId: formData.get("chartEntryId") || null,
    description: formData.get("description") || null,
  };

  const arrayBuffer = await file.arrayBuffer();
  return runAction(() =>
    clinicalImageService.uploadClinicalImage(actor, meta, {
      buffer: Buffer.from(arrayBuffer),
      declaredSize: file.size,
    })
  );
}

export async function deleteClinicalImageAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => clinicalImageService.deleteClinicalImage(actor, input));
}
