"use server";

import * as appointmentService from "@/lib/services/appointment-service";
import * as patientService from "@/lib/services/patient-service";
import { searchPatients as searchPatientsQuery } from "@/lib/services/queries";
import { requireActor, runAction, type ActionResult } from "@/lib/actions/action-result";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";

export async function createAppointmentAction(input: unknown): Promise<ActionResult<AppointmentWithRelations>> {
  const actor = await requireActor();
  return runAction(() => appointmentService.createAppointment(actor, input));
}

export async function updateAppointmentAction(input: unknown): Promise<ActionResult<AppointmentWithRelations>> {
  const actor = await requireActor();
  return runAction(() => appointmentService.updateAppointment(actor, input));
}

export async function changeStatusAction(input: unknown): Promise<ActionResult<AppointmentWithRelations>> {
  const actor = await requireActor();
  return runAction(() => appointmentService.changeStatus(actor, input));
}

export async function cancelAppointmentAction(input: unknown): Promise<ActionResult<AppointmentWithRelations>> {
  const actor = await requireActor();
  return runAction(() => appointmentService.cancelAppointment(actor, input));
}

export async function markFtaAction(input: unknown): Promise<ActionResult<AppointmentWithRelations>> {
  const actor = await requireActor();
  return runAction(() => appointmentService.markFta(actor, input));
}

export async function createPatientAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => patientService.createPatient(actor, input));
}

export async function searchPatientsAction(query: string) {
  const actor = await requireActor();
  return searchPatientsQuery(actor.practiceId, query);
}
