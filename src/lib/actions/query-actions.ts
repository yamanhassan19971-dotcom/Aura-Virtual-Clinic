"use server";

import { requireActor } from "@/lib/actions/action-result";
import { getAppointmentById, getStatusHistory } from "@/lib/services/queries";

export async function getStatusHistoryAction(appointmentId: string) {
  const actor = await requireActor();
  return getStatusHistory(actor.practiceId, appointmentId);
}

export async function getAppointmentByIdAction(appointmentId: string) {
  const actor = await requireActor();
  return getAppointmentById(actor.practiceId, appointmentId);
}
