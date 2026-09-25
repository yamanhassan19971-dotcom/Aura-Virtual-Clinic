"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { PatientNote } from "@prisma/client";
import { formatLongDate } from "@/lib/time";
import { useToast } from "@/components/ui/Toast";
import { createPatientNoteAction } from "@/lib/actions/patient-record-actions";

type NoteRow = PatientNote & { createdBy: { name: string } | null };

export function PatientNotesPanel({
  patientId,
  notes: initialNotes,
  canManage,
  currentUserName,
  startOpen,
}: {
  patientId: string;
  notes: NoteRow[];
  canManage: boolean;
  currentUserName: string;
  startOpen: boolean;
}) {
  const t = useTranslations("patientNotes");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();

  const [notes, setNotes] = useState(initialNotes);
  const [adding, setAdding] = useState(startOpen);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createPatientNoteAction({ patientId, content });
    setSubmitting(false);
    if (result.ok) {
      // The service returns the bare row without relations.
      const created = result.data as PatientNote;
      setNotes((prev) => [{ ...created, createdBy: { name: currentUserName } }, ...prev]);
      setContent("");
      setAdding(false);
      toast.show(tCommon("save"), { tone: "success" });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</h3>
        {canManage && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            {t("addNote")}
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-white p-4">
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("placeholder")}
            rows={3}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-gray-500">
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t("addNote")}
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-gray-400">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-[var(--color-border)] bg-white p-3">
              <p className="whitespace-pre-wrap text-sm text-[var(--color-text)]">{note.content}</p>
              <p className="mt-1 text-xs text-gray-400">
                {t("administrative")} · {note.createdBy?.name ?? "—"} · {formatLongDate(note.createdAt, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
