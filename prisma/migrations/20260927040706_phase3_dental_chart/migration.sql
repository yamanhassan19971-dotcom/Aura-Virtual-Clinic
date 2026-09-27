-- CreateEnum
CREATE TYPE "DentitionType" AS ENUM ('PERMANENT', 'DECIDUOUS');

-- CreateEnum
CREATE TYPE "ToothSurface" AS ENUM ('MESIAL', 'DISTAL', 'OCCLUSAL', 'BUCCAL', 'LINGUAL');

-- CreateEnum
CREATE TYPE "ChartEntryStatus" AS ENUM ('EXISTING', 'PLANNED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ClinicalImageCategory" AS ENUM ('INTRAORAL_PHOTO', 'EXTRAORAL_PHOTO', 'RADIOGRAPH', 'OTHER');

-- CreateEnum
CREATE TYPE "BpeSextant" AS ENUM ('UPPER_RIGHT', 'UPPER_ANTERIOR', 'UPPER_LEFT', 'LOWER_RIGHT', 'LOWER_ANTERIOR', 'LOWER_LEFT');

-- AlterTable
ALTER TABLE "clinical_notes" ADD COLUMN     "chart_entry_id" TEXT,
ADD COLUMN     "tooth_number" TEXT;

-- CreateTable
CREATE TABLE "chart_entries" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "tooth_number" TEXT NOT NULL,
    "dentition_type" "DentitionType" NOT NULL,
    "surface" "ToothSurface",
    "item_code" TEXT NOT NULL,
    "status" "ChartEntryStatus" NOT NULL DEFAULT 'EXISTING',
    "recorded_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "practitioner_id" TEXT,
    "appointment_id" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "completed_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bpe_exams" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "practitioner_id" TEXT,
    "exam_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bpe_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bpe_sextant_scores" (
    "id" TEXT NOT NULL,
    "bpe_exam_id" TEXT NOT NULL,
    "sextant" "BpeSextant" NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "bpe_sextant_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_images" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "tooth_number" TEXT,
    "chart_entry_id" TEXT,
    "category" "ClinicalImageCategory" NOT NULL DEFAULT 'OTHER',
    "filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "description" TEXT,
    "captured_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clinical_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chart_entries_patient_id_tooth_number_idx" ON "chart_entries"("patient_id", "tooth_number");

-- CreateIndex
CREATE INDEX "chart_entries_practice_id_patient_id_idx" ON "chart_entries"("practice_id", "patient_id");

-- CreateIndex
CREATE INDEX "bpe_exams_patient_id_idx" ON "bpe_exams"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "bpe_sextant_scores_bpe_exam_id_sextant_key" ON "bpe_sextant_scores"("bpe_exam_id", "sextant");

-- CreateIndex
CREATE INDEX "clinical_images_patient_id_idx" ON "clinical_images"("patient_id");

-- CreateIndex
CREATE INDEX "clinical_notes_chart_entry_id_idx" ON "clinical_notes"("chart_entry_id");

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_chart_entry_id_fkey" FOREIGN KEY ("chart_entry_id") REFERENCES "chart_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpe_exams" ADD CONSTRAINT "bpe_exams_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpe_exams" ADD CONSTRAINT "bpe_exams_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpe_exams" ADD CONSTRAINT "bpe_exams_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpe_exams" ADD CONSTRAINT "bpe_exams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bpe_sextant_scores" ADD CONSTRAINT "bpe_sextant_scores_bpe_exam_id_fkey" FOREIGN KEY ("bpe_exam_id") REFERENCES "bpe_exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_images" ADD CONSTRAINT "clinical_images_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_images" ADD CONSTRAINT "clinical_images_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_images" ADD CONSTRAINT "clinical_images_chart_entry_id_fkey" FOREIGN KEY ("chart_entry_id") REFERENCES "chart_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_images" ADD CONSTRAINT "clinical_images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
