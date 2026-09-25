import { useTranslations } from "next-intl";
import { decodeReason } from "@/lib/services/codec";
import { MEDICAL_QUESTION_BY_KEY } from "@/lib/medical/question-catalog";

export function AlertBadge({ label, size = "md" }: { label: string; size?: "sm" | "md" }) {
  const t = useTranslations("medical.questions");
  const { code, notes } = decodeReason(label);
  const isCatalogCode = MEDICAL_QUESTION_BY_KEY.has(code);
  const text = isCatalogCode ? t(code) : code;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-[var(--color-status-fta-bg)] font-semibold text-[var(--color-status-fta)] ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      }`}
    >
      <span aria-hidden>⚠</span>
      <span>
        {text}
        {notes ? `: ${notes}` : ""}
      </span>
    </span>
  );
}
