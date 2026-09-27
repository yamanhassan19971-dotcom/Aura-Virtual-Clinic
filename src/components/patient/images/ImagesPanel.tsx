"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ClinicalImage, ClinicalImageCategory } from "@prisma/client";
import { formatLongDate } from "@/lib/time";
import { isValidToothNumber } from "@/lib/dental/teeth";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deleteClinicalImageAction, uploadClinicalImageAction } from "@/lib/actions/clinical-image-actions";

type ImageRow = ClinicalImage & { uploadedBy: { name: string } | null };

const CATEGORIES: ClinicalImageCategory[] = ["INTRAORAL_PHOTO", "EXTRAORAL_PHOTO", "RADIOGRAPH", "OTHER"];

function UploadModal({
  patientId,
  currentUserName,
  onClose,
  onUploaded,
}: {
  patientId: string;
  currentUserName: string;
  onClose: () => void;
  onUploaded: (image: ImageRow) => void;
}) {
  const t = useTranslations("clinicalImages");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<ClinicalImageCategory>("OTHER");
  const [toothNumber, setToothNumber] = useState("");
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
    if (toothNumber) formData.set("toothNumber", toothNumber);
    if (description) formData.set("description", description);
    const result = await uploadClinicalImageAction(formData);
    setSubmitting(false);
    if (result.ok) {
      const created = result.data as ClinicalImage;
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
            onChange={(e) => setCategory(e.target.value as ClinicalImageCategory)}
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
          {t("tooth")}
          <input
            value={toothNumber}
            onChange={(e) => setToothNumber(e.target.value)}
            placeholder="46"
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
          {toothNumber && !isValidToothNumber(toothNumber) && <span className="text-xs text-[var(--color-status-fta)]">{t("invalidTooth")}</span>}
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
            disabled={submitting || !fileName || (toothNumber !== "" && !isValidToothNumber(toothNumber))}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {t("upload")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ImagesPanel({
  patientId,
  images: initialImages,
  canManage,
  currentUserName,
}: {
  patientId: string;
  images: ImageRow[];
  canManage: boolean;
  currentUserName: string;
}) {
  const t = useTranslations("clinicalImages");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();

  const [images, setImages] = useState(initialImages);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImageRow | null>(null);

  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  async function handleDelete(imageId: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    const result = await deleteClinicalImageAction({ imageId });
    if (result.ok) {
      setImages((prev) => prev.filter((i) => i.id !== imageId));
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

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

      {images.length === 0 ? (
        <p className="text-sm text-gray-400">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <li key={image.id} className="rounded-md border border-[var(--color-border)] bg-white p-3">
              <p className="truncate text-sm font-medium text-[var(--color-text)]" title={image.filename}>
                {image.filename}
              </p>
              <p className="text-xs text-gray-500">
                {t(`categories.${image.category}`)}
                {image.toothNumber ? ` · ${image.toothNumber}` : ""}
              </p>
              {image.description && <p className="mt-1 text-xs text-gray-600">{image.description}</p>}
              <p className="mt-1 text-xs text-gray-400">
                {t("uploadedBy", { name: image.uploadedBy?.name ?? "—", date: formatLongDate(image.uploadedAt, locale) })}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs font-medium">
                {image.mimeType.startsWith("image/") && (
                  <button type="button" onClick={() => setPreviewImage(image)} className="text-[var(--color-blue)] hover:underline">
                    {t("preview")}
                  </button>
                )}
                <a href={`/api/clinical-images/${image.id}`} download={image.filename} className="text-[var(--color-blue)] hover:underline">
                  {t("download")}
                </a>
                {canManage && (
                  <button type="button" onClick={() => handleDelete(image.id)} className="text-gray-400 hover:text-[var(--color-status-fta)]">
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
          onUploaded={(image) => {
            setImages((prev) => [image, ...prev]);
            setUploadOpen(false);
            router.refresh();
          }}
        />
      )}

      {previewImage && (
        <Modal title={previewImage.filename} onClose={() => setPreviewImage(null)} width="lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/clinical-images/${previewImage.id}`} alt={previewImage.filename} className="max-h-[70vh] w-full object-contain" />
        </Modal>
      )}
    </div>
  );
}
