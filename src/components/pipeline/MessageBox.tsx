"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { secondaryButton } from "@/components/pipeline/usePipelineAction";

/**
 * A ready-made Arabic message with one-tap actions. WhatsApp opens with the
 * text typed in; the staff member reads it, edits if needed, and sends.
 */
export function MessageBox({
  text,
  whatsAppUrl,
  telUrl,
  compact = false,
}: {
  text: string;
  whatsAppUrl: string | null;
  telUrl?: string | null;
  compact?: boolean;
}) {
  const t = useTranslations("pipeline.leads");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked on plain-http LAN addresses; the text is still selectable.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p
        dir="rtl"
        lang="ar"
        className={`whitespace-pre-line rounded-md bg-emerald-50/60 px-3 py-2 text-sm leading-relaxed text-gray-800 ${
          compact ? "line-clamp-3" : ""
        }`}
      >
        {text}
      </p>
      <div className="flex flex-wrap gap-2">
        {whatsAppUrl ? (
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {t("openWhatsApp")}
          </a>
        ) : (
          <span className="text-xs text-amber-700">{t("noPhone")}</span>
        )}
        {telUrl && (
          <a href={telUrl} className={secondaryButton}>
            {t("call")}
          </a>
        )}
        <button type="button" onClick={copy} className={secondaryButton}>
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    </div>
  );
}
