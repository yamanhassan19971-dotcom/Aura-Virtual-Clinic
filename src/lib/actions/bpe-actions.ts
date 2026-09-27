"use server";

import * as bpeService from "@/lib/services/bpe-service";
import { requireActor, runAction } from "@/lib/actions/action-result";

export async function createBpeExamAction(input: unknown) {
  const actor = await requireActor();
  return runAction(() => bpeService.createBpeExam(actor, input));
}
