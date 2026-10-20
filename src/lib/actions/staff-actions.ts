"use server";

import { revalidatePath } from "next/cache";
import * as staffService from "@/lib/services/staff-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function createStaffAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => staffService.createStaff(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateStaffAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => staffService.updateStaff(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function resetStaffPasswordAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => staffService.resetStaffPassword(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function setStaffActiveAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => staffService.setStaffActive(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function changeOwnPasswordAction(input: unknown) {
  const actor = await requireActor();
  const result = await runAction(() => staffService.changeOwnPassword(actor, input));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
