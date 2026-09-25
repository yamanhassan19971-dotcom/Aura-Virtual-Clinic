"use server";

import * as medicalService from "@/lib/services/medical-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function submitMedicalHistoryAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => medicalService.submitMedicalHistory(actor, input));
}

export async function addMedicalAlertAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => medicalService.addMedicalAlert(actor, input));
}

export async function resolveMedicalAlertAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => medicalService.resolveMedicalAlert(actor, input));
}
