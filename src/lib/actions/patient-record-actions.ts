"use server";

import * as patientRecordService from "@/lib/services/patient-record-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function createPatientNoteAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientRecordService.createPatientNote(actor, input));
}

export async function createTaskAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientRecordService.createTask(actor, input));
}

export async function updateTaskStatusAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientRecordService.updateTaskStatus(actor, input));
}

export async function addFlagAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientRecordService.addFlag(actor, input));
}

export async function resolveFlagAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientRecordService.resolveFlag(actor, input));
}

export async function uploadDocumentAction(formData: FormData) {
  const actor = await requireActor();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false as const, kind: "VALIDATION" as const, message: "No file provided." };
  }

  const meta = {
    patientId: formData.get("patientId"),
    filename: file.name,
    category: formData.get("category") || "OTHER",
    description: formData.get("description") || null,
  };

  const arrayBuffer = await file.arrayBuffer();
  return runAction(() =>
    patientRecordService.uploadDocument(actor, meta, {
      buffer: Buffer.from(arrayBuffer),
      declaredSize: file.size,
    })
  );
}

export async function deleteDocumentAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientRecordService.deleteDocument(actor, input));
}
