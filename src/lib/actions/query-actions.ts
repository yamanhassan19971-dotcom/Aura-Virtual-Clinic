"use server";

import { requireActor } from "@/lib/actions/action-result";
import { getAppointmentById, getStatusHistory } from "@/lib/services/queries";
import { getToothHistory } from "@/lib/services/patient-queries";

export async function getStatusHistoryAction(appointmentId: string) {
  const actor = await requireActor();
  return getStatusHistory(actor.practiceId, appointmentId);
}

export async function getAppointmentByIdAction(appointmentId: string) {
  const actor = await requireActor();
  return getAppointmentById(actor.practiceId, appointmentId);
}

export async function getToothHistoryAction(patientId: string, toothNumber: string) {
  const actor = await requireActor();
  return getToothHistory(actor.practiceId, patientId, toothNumber);
}
