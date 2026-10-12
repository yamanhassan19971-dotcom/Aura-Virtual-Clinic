"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions/action-result";

/**
 * Runs a billing server action, then refreshes the server-rendered page so
 * every derived figure (totals, balances, stage allocation) is recomputed
 * by the server rather than patched client-side. Business-rule failures are
 * shown in the user's language via their stable `code`.
 */
export function useBillingAction() {
  const router = useRouter();
  const toast = useToast();
  const tErrors = useTranslations("billing.errors");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();

  async function run<T>(action: () => Promise<ActionResult<T>>, opts: { success?: string } = {}): Promise<T | null> {
    const result = await action();
    if (result.ok) {
      startTransition(() => router.refresh());
      toast.show(opts.success ?? tCommon("save"), { tone: "success" });
      return result.data;
    }
    const message = result.code && tErrors.has(result.code) ? tErrors(result.code) : result.message;
    toast.show(message, { tone: "error" });
    return null;
  }

  return { run, pending };
}
