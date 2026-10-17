-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CALL_BOOKED', 'THINKING', 'CONSULT_BOOKED', 'ATTENDED', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('FACEBOOK_AD', 'INSTAGRAM', 'GOOGLE', 'WEBSITE', 'REFERRAL', 'WALK_IN', 'PHONE_CALL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadInterest" AS ENUM ('IMPLANTS', 'SMILE_4D', 'ORTHODONTICS', 'HOLLYWOOD_SMILE', 'GENERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadActivityKind" AS ENUM ('CREATED', 'REPLIED', 'CALL_BOOKED', 'CALL_NO_ANSWER', 'CALL_REACHED', 'WHATSAPP_SENT', 'THINKING', 'CONSULT_BOOKED', 'ATTENDED', 'LOST', 'REOPENED', 'NOTE');

-- CreateEnum
CREATE TYPE "FollowUpKind" AS ENUM ('CONFIRM_BOOKING', 'REMIND_DAY_BEFORE', 'REMIND_3H', 'POST_OP_EVENING', 'POST_OP_NEXT_DAY', 'POST_OP_WEEK', 'PLAN_DECISION', 'SATISFACTION', 'REVIEW_REQUEST', 'RECALL', 'REBOOK_MISSED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FollowUpChannel" AS ENUM ('WHATSAPP', 'CALL');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('DUE', 'DONE', 'SKIPPED');

-- AlterTable
ALTER TABLE "appointment_types" ADD COLUMN     "post_op_follow_up" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "practitioners" ADD COLUMN     "name_ar" TEXT;

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "lead_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "source_note" TEXT,
    "interest" "LeadInterest" NOT NULL,
    "for_whom" TEXT,
    "location" TEXT,
    "key_words" TEXT,
    "told_so_far" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "lost_reason" TEXT,
    "first_message_at" TIMESTAMP(3) NOT NULL,
    "first_reply_at" TIMESTAMP(3),
    "call_at" TIMESTAMP(3),
    "call_attempts" INTEGER NOT NULL DEFAULT 0,
    "call_booked_at" TIMESTAMP(3),
    "consult_booked_at" TIMESTAMP(3),
    "attended_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "assigned_to_user_id" TEXT,
    "patient_id" TEXT,
    "consult_appointment_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "kind" "LeadActivityKind" NOT NULL,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "plan_id" TEXT,
    "kind" "FollowUpKind" NOT NULL,
    "channel" "FollowUpChannel" NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'DUE',
    "note" TEXT,
    "outcome" TEXT,
    "satisfaction_score" INTEGER,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_lead_number_key" ON "leads"("lead_number");

-- CreateIndex
CREATE INDEX "leads_practice_id_stage_idx" ON "leads"("practice_id", "stage");

-- CreateIndex
CREATE INDEX "leads_practice_id_first_message_at_idx" ON "leads"("practice_id", "first_message_at");

-- CreateIndex
CREATE INDEX "leads_consult_appointment_id_idx" ON "leads"("consult_appointment_id");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_idx" ON "lead_activities"("lead_id");

-- CreateIndex
CREATE INDEX "follow_ups_practice_id_status_due_at_idx" ON "follow_ups"("practice_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "follow_ups_patient_id_idx" ON "follow_ups"("patient_id");

-- CreateIndex
CREATE INDEX "follow_ups_appointment_id_idx" ON "follow_ups"("appointment_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_consult_appointment_id_fkey" FOREIGN KEY ("consult_appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
