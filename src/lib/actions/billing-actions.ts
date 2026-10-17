"use server";

import * as billingService from "@/lib/services/billing-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function createCatalogItemAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.createCatalogItem(actor, input));
}

export async function updateCatalogItemAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.updateCatalogItem(actor, input));
}

export async function createPlanAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.createPlan(actor, input));
}

export async function updatePlanAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.updatePlan(actor, input));
}

export async function addPlanItemAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.addPlanItem(actor, input));
}

export async function removePlanItemAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.removePlanItem(actor, input));
}

export async function completePlanItemAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.completePlanItem(actor, input));
}

export async function cancelPlanItemAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.cancelPlanItem(actor, input));
}

export async function changePlanStatusAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.changePlanStatus(actor, input));
}

export async function recordPaymentAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.recordPayment(actor, input));
}

export async function voidPaymentAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.voidPayment(actor, input));
}

export async function requestRefundAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.requestRefund(actor, input));
}

export async function processRefundAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => billingService.processRefund(actor, input));
}
