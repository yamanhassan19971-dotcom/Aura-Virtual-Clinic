"use server";

import * as leadService from "@/lib/services/lead-service";
import * as followUpService from "@/lib/services/follow-up-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function createLeadAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => leadService.createLead(actor, input));
}

export async function updateLeadAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => leadService.updateLead(actor, input));
}

export async function markLeadRepliedAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => leadService.markReplied(actor, input));
}

export async function scheduleLeadCallAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => leadService.scheduleCall(actor, input));
}

export async function logLeadContactAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => leadService.logContact(actor, input));
}

export async function markLeadThinkingAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => leadService.markThinking(actor, input));
}

export async function markLeadLostAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => leadService.markLost(actor, input));
}

export async function reopenLeadAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => leadService.reopenLead(actor, input));
}

export async function bookLeadConsultationAction(input: unknown) {
  const actor = await requireActor();
  return runAction(async () => {
    const { lead, appointment } = await leadService.bookConsultation(actor, input);
    return { leadId: lead.id, appointmentId: appointment.id, patientId: lead.patientId };
  });
}

export async function completeFollowUpAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => followUpService.completeFollowUp(actor, input));
}

export async function skipFollowUpAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => followUpService.skipFollowUp(actor, input));
}

export async function rescheduleFollowUpAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => followUpService.rescheduleFollowUp(actor, input));
}

export async function createFollowUpAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => followUpService.createFollowUp(actor, input));
}
