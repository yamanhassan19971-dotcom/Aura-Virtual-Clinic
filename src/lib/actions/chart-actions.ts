"use server";

import * as chartService from "@/lib/services/chart-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function createChartEntryAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => chartService.createChartEntry(actor, input));
}

export async function completeChartEntryAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => chartService.completeChartEntry(actor, input));
}

export async function retractChartEntryAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => chartService.retractChartEntry(actor, input));
}
