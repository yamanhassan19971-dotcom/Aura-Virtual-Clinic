"use server";

import * as clinicalNoteService from "@/lib/services/clinical-note-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function createClinicalNoteAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => clinicalNoteService.createClinicalNote(actor, input));
}

export async function updateClinicalNoteDraftAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => clinicalNoteService.updateClinicalNoteDraft(actor, input));
}

export async function signClinicalNoteAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => clinicalNoteService.signClinicalNote(actor, input));
}

export async function addNoteAmendmentAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => clinicalNoteService.addNoteAmendment(actor, input));
}

export async function createNoteTemplateAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => clinicalNoteService.createNoteTemplate(actor, input));
}
