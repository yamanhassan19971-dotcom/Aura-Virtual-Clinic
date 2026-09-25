"use server";

import * as patientService from "@/lib/services/patient-service";
import { searchPatientsFull } from "@/lib/services/patient-queries";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function updatePatientDetailsAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientService.updatePatientDetails(actor, input));
}

export async function setPatientStatusAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientService.setPatientStatus(actor, input));
}

export async function checkForDuplicatesAction(input: unknown) {
  const actor = await requireActor();
  return patientService.checkForDuplicates(actor, input);
}

export async function linkFamilyMemberAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientService.linkFamilyMember(actor, input));
}

export async function unlinkFamilyMemberAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientService.unlinkFamilyMember(actor, input));
}

export async function searchPatientsFullAction(query: string, opts: { includeArchived?: boolean } = {}) {
  const actor = await requireActor();
  return searchPatientsFull(actor.practiceId, query, opts);
}
