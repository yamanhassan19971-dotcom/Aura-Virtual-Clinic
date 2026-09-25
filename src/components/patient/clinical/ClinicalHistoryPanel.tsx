"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import type { ClinicalNote, ClinicalNoteAmendment, ClinicalNoteTemplate, Practitioner } from "@prisma/client";
import { formatLongDate } from "@/lib/time";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  addNoteAmendmentAction,
  createClinicalNoteAction,
  signClinicalNoteAction,
  updateClinicalNoteDraftAction,
} from "@/lib/actions/clinical-note-actions";
import type { getClinicalHistory } from "@/lib/services/patient-queries";

type NoteRow = Awaited<ReturnType<typeof getClinicalHistory>>[number];

function NoteCreateModal({
  patientId,
  practitioners,
  templates,
  defaultPractitionerId,
  defaultAppointmentId,
  currentUserName,
  onClose,
  onCreated,
}: {
  patientId: string;
  practitioners: Practitioner[];
  templates: ClinicalNoteTemplate[];
  defaultPractitionerId: string | null;
  defaultAppointmentId: string | null;
  currentUserName: string;
  onClose: () => void;
  onCreated: (note: NoteRow) => void;
}) {
  const t = useTranslations("clinicalNotes");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [practitionerId, setPractitionerId] = useState(defaultPractitionerId ?? practitioners[0]?.id ?? "");
  const [templateId, setTemplateId] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((tp) => tp.id === id);
    if (tpl) setContent(tpl.body);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createClinicalNoteAction({
      patientId,
      practitionerId,
      appointmentId: defaultAppointmentId,
      content,
    });
    setSubmitting(false);
    if (result.ok) {
      toast.show(tCommon("save"), { tone: "success" });
      // The service returns the bare row without relations — attach what we
      // already know client-side rather than refetching.
      const created = result.data as ClinicalNote;
      const practitioner = practitioners.find((p) => p.id === practitionerId);
      onCreated({
        ...created,
        practitioner: { name: practitioner?.name ?? "" },
        createdBy: { name: currentUserName },
        appointment: null,
        signedBy: null,
        amendments: [],
      });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <Modal title={t("newNote")} onClose={onClose} width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("practitioner")}
          <select
            value={practitionerId}
            onChange={(e) => setPractitionerId(e.target.value)}
            required
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {templates.length > 0 && (
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("template")}
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="">{t("noTemplate")}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("content")}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={10}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || !content.trim() || !practitionerId}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AmendmentForm({
  note,
  currentUserName,
  onAdded,
}: {
  note: NoteRow;
  currentUserName: string;
  onAdded: (note: NoteRow) => void;
}) {
  const t = useTranslations("clinicalNotes");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await addNoteAmendmentAction({ noteId: note.id, content });
    setSubmitting(false);
    if (result.ok) {
      const amendment = result.data as ClinicalNoteAmendment;
      onAdded({
        ...note,
        amendments: [...note.amendments, { ...amendment, createdBy: { name: currentUserName } }],
      });
      setContent("");
      setOpen(false);
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded-md border border-dashed border-[var(--color-border)] px-3 py-1 text-xs font-medium text-gray-500 hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]"
      >
        + {t("addAmendment")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("amendmentPlaceholder")}
        rows={3}
        autoFocus
        className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">
          ×
        </button>
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="rounded-md bg-[var(--color-navy)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {t("addAmendment")}
        </button>
      </div>
    </form>
  );
}

function NoteCard({
  note,
  canManageNotes,
  currentUserName,
  onChange,
}: {
  note: NoteRow;
  canManageNotes: boolean;
  currentUserName: string;
  onChange: (n: NoteRow) => void;
}) {
  const t = useTranslations("clinicalNotes");
  const locale = useLocale();
  const toast = useToast();
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [submitting, setSubmitting] = useState(false);

  async function handleSaveDraft() {
    setSubmitting(true);
    const result = await updateClinicalNoteDraftAction({ noteId: note.id, content });
    setSubmitting(false);
    if (result.ok) {
      const updated = result.data as ClinicalNote;
      onChange({ ...note, content: updated.content, updatedAt: updated.updatedAt });
      setEditing(false);
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  async function handleSign() {
    if (!window.confirm(t("signConfirm"))) return;
    const result = await signClinicalNoteAction({ noteId: note.id });
    if (result.ok) {
      const updated = result.data as ClinicalNote;
      onChange({
        ...note,
        status: updated.status,
        signedAt: updated.signedAt,
        signedById: updated.signedById,
        signedBy: { name: currentUserName },
      });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <li className="rounded-md border border-[var(--color-border)] p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm font-medium text-[var(--color-text)]">{formatLongDate(note.createdAt, locale)}</span>
          <span className="ms-2 text-xs text-gray-500">{note.practitioner.name}</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            note.status === "SIGNED"
              ? "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed)]"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {t(`status.${note.status}`)}
        </span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500">
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSaveDraft}
              className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t("save")}
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-[var(--color-text)]">{note.content}</p>
      )}

      {note.status === "SIGNED" && note.signedBy && (
        <p className="mt-1 text-xs text-gray-400">{t("signedBy", { name: note.signedBy.name })}</p>
      )}

      {note.amendments.length > 0 && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("amendments")}</p>
          <ul className="flex flex-col gap-2">
            {note.amendments.map((a) => (
              <li key={a.id} className="rounded-md bg-gray-50 p-2 text-sm text-[var(--color-text)]">
                <p className="whitespace-pre-wrap">{a.content}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {a.createdBy?.name ?? "—"} · {formatLongDate(a.createdAt, locale)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManageNotes && !editing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {note.status === "DRAFT" && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-[var(--color-blue)] hover:underline">
                {tCommon("edit")}
              </button>
              <button
                type="button"
                onClick={handleSign}
                className="rounded-md bg-[var(--color-navy)] px-2.5 py-1 text-xs font-semibold text-white"
              >
                {t("sign")}
              </button>
            </>
          )}
          {note.status === "SIGNED" && (
            <AmendmentForm note={note} currentUserName={currentUserName} onAdded={onChange} />
          )}
        </div>
      )}
    </li>
  );
}

export function ClinicalHistoryPanel({
  patientId,
  notes: initialNotes,
  templates,
  practitioners,
  defaultPractitionerId,
  currentUserName,
  canManageNotes,
  startOpen,
}: {
  patientId: string;
  notes: NoteRow[];
  templates: ClinicalNoteTemplate[];
  practitioners: Practitioner[];
  defaultPractitionerId: string | null;
  currentUserName: string;
  canManageNotes: boolean;
  canManageTemplates: boolean;
  startOpen: boolean;
}) {
  const t = useTranslations("clinicalHistory");
  const tNotes = useTranslations("clinicalNotes");
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAppointment = searchParams.get("fromAppointment");

  const [notes, setNotes] = useState(initialNotes);
  const [createOpen, setCreateOpen] = useState(startOpen);
  const [search, setSearch] = useState("");
  const [practitionerFilter, setPractitionerFilter] = useState("");

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const filtered = notes.filter((n) => {
    if (practitionerFilter && n.practitionerId !== practitionerFilter) return false;
    if (search && !n.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
          />
          <select
            value={practitionerFilter}
            onChange={(e) => setPractitionerFilter(e.target.value)}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            <option value="">{t("allPractitioners")}</option>
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {canManageNotes && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            {tNotes("addNote")}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              canManageNotes={canManageNotes}
              currentUserName={currentUserName}
              onChange={(updated) => setNotes((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
            />
          ))}
        </ul>
      )}

      {createOpen && (
        <NoteCreateModal
          patientId={patientId}
          practitioners={practitioners}
          templates={templates}
          defaultPractitionerId={defaultPractitionerId}
          defaultAppointmentId={fromAppointment}
          currentUserName={currentUserName}
          onClose={() => setCreateOpen(false)}
          onCreated={(note) => {
            setNotes((prev) => [note, ...prev]);
            setCreateOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
