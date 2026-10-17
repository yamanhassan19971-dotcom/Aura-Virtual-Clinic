import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const LEAD_SOURCES = [
  "FACEBOOK_AD",
  "INSTAGRAM",
  "GOOGLE",
  "WEBSITE",
  "REFERRAL",
  "WALK_IN",
  "PHONE_CALL",
  "OTHER",
] as const;
export const LEAD_INTERESTS = ["IMPLANTS", "SMILE_4D", "ORTHODONTICS", "HOLLYWOOD_SMILE", "GENERAL", "OTHER"] as const;
export const LEAD_STAGES = ["NEW", "CALL_BOOKED", "THINKING", "CONSULT_BOOKED", "ATTENDED", "LOST"] as const;
export const LOST_REASONS = ["PRICE", "WENT_ELSEWHERE", "NOT_READY", "NO_RESPONSE", "TOO_FAR", "OTHER"] as const;

// --- Leads ----------------------------------------------------------------

export const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40),
  source: z.enum(LEAD_SOURCES),
  sourceNote: optionalText(200),
  interest: z.enum(LEAD_INTERESTS),
  forWhom: optionalText(120),
  location: optionalText(120),
  keyWords: optionalText(1000),
  toldSoFar: optionalText(1000),
  firstMessageAt: z.coerce.date().optional(),
  /** The agent already sent the first reply while logging the enquiry. */
  replied: z.boolean().optional(),
  callAt: z.coerce.date().optional().nullable(),
});

export const updateLeadSchema = z.object({
  leadId: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(6).max(40).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  sourceNote: optionalText(200),
  interest: z.enum(LEAD_INTERESTS).optional(),
  forWhom: optionalText(120),
  location: optionalText(120),
  keyWords: optionalText(1000),
  toldSoFar: optionalText(1000),
});

export const leadRefSchema = z.object({ leadId: z.string().min(1), note: optionalText(1000) });

export const scheduleCallSchema = z.object({
  leadId: z.string().min(1),
  callAt: z.coerce.date(),
  note: optionalText(1000),
});

export const LEAD_CALL_OUTCOMES = ["NO_ANSWER", "REACHED", "WHATSAPP_SENT", "NOTE"] as const;

export const logLeadContactSchema = z.object({
  leadId: z.string().min(1),
  outcome: z.enum(LEAD_CALL_OUTCOMES),
  note: optionalText(1000),
});

export const markThinkingSchema = z.object({
  leadId: z.string().min(1),
  followUpAt: z.coerce.date(),
  note: optionalText(1000),
});

export const markLostSchema = z.object({
  leadId: z.string().min(1),
  reason: z.enum(LOST_REASONS),
  note: optionalText(1000),
});

/**
 * Books the free consultation. Either links an existing patient, or creates
 * the patient record from the lead (first/last name and date of birth are
 * needed for the patient file).
 */
export const bookConsultationSchema = z
  .object({
    leadId: z.string().min(1),
    patientId: z.string().min(1).optional().nullable(),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    dateOfBirth: z.coerce.date().optional(),
    practitionerId: z.string().min(1),
    roomId: z.string().min(1),
    appointmentTypeId: z.string().min(1),
    startTime: z.coerce.date(),
    durationMin: z.number().int().min(5).max(480),
    overrideConflict: z.boolean().optional(),
  })
  .refine((v) => v.patientId || (v.firstName && v.lastName && v.dateOfBirth), {
    message: "Choose an existing patient or enter first name, last name and date of birth",
    path: ["firstName"],
  });

export const leadListFilterSchema = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  q: z.string().trim().max(100).optional(),
});

// --- Follow-ups -----------------------------------------------------------

export const completeFollowUpSchema = z.object({
  followUpId: z.string().min(1),
  outcome: optionalText(1000),
  satisfactionScore: z.number().int().min(1).max(10).optional().nullable(),
});

export const skipFollowUpSchema = z.object({
  followUpId: z.string().min(1),
  outcome: optionalText(1000),
});

export const rescheduleFollowUpSchema = z.object({
  followUpId: z.string().min(1),
  dueAt: z.coerce.date(),
});

export const createFollowUpSchema = z.object({
  patientId: z.string().min(1),
  channel: z.enum(["WHATSAPP", "CALL"]),
  dueAt: z.coerce.date(),
  note: z.string().trim().min(1).max(1000),
});

export const FOLLOW_UP_VIEWS = ["today", "upcoming", "done"] as const;
