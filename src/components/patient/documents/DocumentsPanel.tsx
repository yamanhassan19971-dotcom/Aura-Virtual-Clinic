"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { DocumentCategory, PatientDocument } from "@prisma/client";
import { formatLongDate } from "@/lib/time";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deleteDocumentAction, uploadDocumentAction } from "@/lib/actions/patient-record-actions";

type DocumentRow = PatientDocument & { uploadedBy: { name: string } | null };

const CATEGORIES: DocumentCategory[] = [
  "RADIOGRAPH",
  "CLINICAL_PHOTOGRAPH",
  "REFERRAL",
  "MEDICAL_REPORT",
  "CONSENT",
  "LAB",
  "CORRESPONDENCE",
  "OTHER",
];

const PREVIEWABLE_MIME_PREFIXES = ["image/", "application/pdf"];

function UploadModal({
  patientId,
  currentUserName,
  onClose,
  onUploaded,
}: {
  patientId: string;
  currentUserName: string;
  onClose: () => void;
  onUploaded: (doc: DocumentRow) => void;
}) {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<DocumentCategory>("OTHER");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("patientId", patientId);
    formData.set("category", category);
    if (description) formData.set("description", description);
    const result = await uploadDocumentAction(formData);
    setSubmitting(false);
    if (result.ok) {
      const created = result.data as PatientDocument;
      onUploaded({ ...created, uploadedBy: { name: currentUserName } });
      toast.show(tCommon("save"), { tone: "success" });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <Modal title={t("upload")} onClose={onClose} width="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("chooseFile")}
          <input
            ref={fileRef}
            type="file"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("category")}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("description")}
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            disabled={submitting || !fileName}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {t("upload")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DocumentsPanel({
  patientId,
  documents: initialDocuments,
  canManage,
  currentUserName,
  startOpen,
}: {
  patientId: string;
  documents: DocumentRow[];
  canManage: boolean;
  currentUserName: string;
  startOpen: boolean;
}) {
  const t = useTranslations("documents");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();

  const [documents, setDocuments] = useState(initialDocuments);
  const [uploadOpen, setUploadOpen] = useState(startOpen);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  async function handleDelete(documentId: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    const result = await deleteDocumentAction({ documentId });
    if (result.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  const isPreviewable = (mimeType: string) => PREVIEWABLE_MIME_PREFIXES.some((p) => mimeType.startsWith(p));

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</h3>
        {canManage && (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            {t("upload")}
          </button>
        )}
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-gray-400">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded-md border border-[var(--color-border)] bg-white p-3">
              <p className="truncate text-sm font-medium text-[var(--color-text)]" title={doc.filename}>
                {doc.filename}
              </p>
              <p className="text-xs text-gray-500">{t(`categories.${doc.category}`)}</p>
              {doc.description && <p className="mt-1 text-xs text-gray-600">{doc.description}</p>}
              <p className="mt-1 text-xs text-gray-400">
                {t("uploadedBy", { name: doc.uploadedBy?.name ?? "—", date: formatLongDate(doc.uploadedAt, locale) })}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs font-medium">
                {isPreviewable(doc.mimeType) && (
                  <button type="button" onClick={() => setPreviewDoc(doc)} className="text-[var(--color-blue)] hover:underline">
                    {t("preview")}
                  </button>
                )}
                <a href={`/api/documents/${doc.id}`} download={doc.filename} className="text-[var(--color-blue)] hover:underline">
                  {t("download")}
                </a>
                {canManage && (
                  <button type="button" onClick={() => handleDelete(doc.id)} className="text-gray-400 hover:text-[var(--color-status-fta)]">
                    {t("delete")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {uploadOpen && (
        <UploadModal
          patientId={patientId}
          currentUserName={currentUserName}
          onClose={() => setUploadOpen(false)}
          onUploaded={(doc) => {
            setDocuments((prev) => [doc, ...prev]);
            setUploadOpen(false);
            router.refresh();
          }}
        />
      )}

      {previewDoc && (
        <Modal title={previewDoc.filename} onClose={() => setPreviewDoc(null)} width="lg">
          {previewDoc.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/documents/${previewDoc.id}`} alt={previewDoc.filename} className="max-h-[70vh] w-full object-contain" />
          ) : previewDoc.mimeType === "application/pdf" ? (
            <iframe src={`/api/documents/${previewDoc.id}`} title={previewDoc.filename} className="h-[70vh] w-full" />
          ) : (
            <p className="text-sm text-gray-500">{t("unsupportedPreview")}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
