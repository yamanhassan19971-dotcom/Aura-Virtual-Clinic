"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions/action-result";

/** Runs a pipeline server action, refreshes the server-rendered page, and toasts the outcome in the user's language. */
export function usePipelineAction() {
  const router = useRouter();
  const toast = useToast();
  const tErrors = useTranslations("pipeline.errors");
  const tSettings = useTranslations("settings");
  const [pending, startTransition] = useTransition();

  async function run<T>(
    action: () => Promise<ActionResult<T>>,
    opts: { success?: string; onError?: (result: Extract<ActionResult<T>, { ok: false }>) => boolean } = {}
  ): Promise<T | null> {
    const result = await action();
    if (result.ok) {
      startTransition(() => router.refresh());
      toast.show(opts.success ?? tSettings("saved"), { tone: "success" });
      return result.data;
    }
    // The caller can show the error itself (e.g. a booking clash next to the time field).
    if (opts.onError?.(result)) return null;
    const key = result.code ?? result.kind;
    toast.show(key && tErrors.has(key) ? tErrors(key) : result.message, { tone: "error" });
    return null;
  }

  return { run, pending };
}

/** "2026-10-17T18:00" for a datetime-local input, in the device's local time. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const inputClass = "w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm";
export const labelClass = "flex flex-col gap-1 text-sm font-medium text-gray-700";
export const primaryButton =
  "rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60";
export const secondaryButton =
  "rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60";
