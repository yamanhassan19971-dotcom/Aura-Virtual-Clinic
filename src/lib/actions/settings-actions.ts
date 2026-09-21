"use server";

import { revalidatePath } from "next/cache";
import * as settingsService from "@/lib/services/settings-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function createPractitionerAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => settingsService.createPractitioner(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updatePractitionerAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => settingsService.updatePractitioner(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function createAppointmentTypeAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => settingsService.createAppointmentType(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateAppointmentTypeAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => settingsService.updateAppointmentType(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function setWorkingHoursAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => settingsService.setWorkingHours(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
