import type { FollowUpKind, LeadInterest } from "@prisma/client";
import { CLINIC_PROFILE } from "@/lib/clinic-profile";

// Ready-to-send Arabic messages and call openers, taken from the Phase 3
// patient-journey playbook. Patients are always written to in Syrian Arabic,
// whatever language the staff member's screen is in.

export type MessageContext = {
  patientName: string;
  staffName?: string | null;
  doctorName?: string | null;
  /** Appointment start, for booking reminders. */
  startTime?: Date | null;
  isConsultation?: boolean;
  interest?: LeadInterest | null;
};

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const INTEREST_AR: Record<LeadInterest, string> = {
  IMPLANTS: "الزرعات",
  SMILE_4D: "ابتسامة 4D",
  ORTHODONTICS: "التقويم",
  HOLLYWOOD_SMILE: "ابتسامة هوليود",
  GENERAL: "علاج الأسنان",
  OTHER: "علاج الأسنان",
};

export function arabicDay(date: Date): string {
  return `${WEEKDAYS_AR[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
}

/** "6 مساءً", "10:30 صباحاً" — the way the team writes times to patients. */
export function arabicTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const period = h < 12 ? "صباحاً" : h < 17 ? "الظهر" : "مساءً";
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${period}`;
}

function location(): string {
  const link = CLINIC_PROFILE.mapsUrl ?? "[رابط الموقع]";
  return `📍 مركز أورا، ${CLINIC_PROFILE.addressAr}: ${link}`;
}

function doctor(ctx: MessageContext): string {
  return ctx.doctorName ? ctx.doctorName : "الطبيب";
}

/** The WhatsApp text for a follow-up, or the opening line for a call. */
export function followUpMessage(kind: FollowUpKind, ctx: MessageContext): string {
  const name = ctx.patientName;
  const day = ctx.startTime ? arabicDay(ctx.startTime) : "[اليوم]";
  const time = ctx.startTime ? arabicTime(ctx.startTime) : "[الساعة]";
  switch (kind) {
    case "CONFIRM_BOOKING":
      return [
        `أهلاً ${name} 🌿 موعدك مع ${doctor(ctx)} يوم ${day} الساعة ${time}.`,
        location() + ".",
        ctx.isConsultation ? "الاستشارة مجانية. إذا عندك صور أشعة قديمة، جيبها معك." : null,
        "هالموعد محجوز إلك، وإذا صار شي ابعتلي لنغيره 🙏",
      ]
        .filter(Boolean)
        .join("\n");
    case "REMIND_DAY_BEFORE":
      return `مسا الخير ${name} 🌿 بس حبيت ذكرك بموعدك بكرا الساعة ${time} مع ${doctor(ctx)}. كل شي تمام لبكرا؟`;
    case "REMIND_3H":
      return `أهلين ${name} 🌿 تذكير صغير بموعدك اليوم الساعة ${time}.\n${location()}\nمنستناك!`;
    case "POST_OP_EVENING":
      return `إن شاء الله مرتاح ${name}؟ 🌿 إذا بتحب بعتلك التعليمات مرة تانية، وأي شي بتحسه خبرني، أنا هون.`;
    case "POST_OP_NEXT_DAY":
      return `أهلين ${name}، معك ${ctx.staffName ?? "[اسمك]"} من مركز أورا. حبيت أطمن عليك: كيف كانت الليلة؟ في وجع أو ورم؟`;
    case "POST_OP_WEEK":
      return `أهلين ${name} 🌿 كيف صار الأكل؟ كل شي ماشي تمام؟`;
    case "PLAN_DECISION":
      return `أهلين ${name}، معك ${ctx.staffName ?? "[اسمك]"} من مركز أورا. حبيت أطمن عليك بعد الاستشارة مع ${doctor(ctx)}. إذا في أي سؤال عن الخطة أو الدفع أنا جاهز، وإذا حابب منحجزلك موعد البداية.`;
    case "SATISFACTION":
      return `أهلين ${name}، مبروك خلصنا المعالجة 🌿 بدي اسألك سؤال واحد: من 1 لـ 10، قديش مبسوط من تجربتك معنا؟`;
    case "REVIEW_REQUEST":
      return `${name}، كتير فرحنا إنك مبسوط بالنتيجة 🌿 إذا عندك دقيقة، تقييمك على غوغل بيساعد ناس متلك يلاقونا ويرتاحوا بالقرار: ${CLINIC_PROFILE.googleReviewUrl ?? "[رابط التقييم]"}. شكراً من كل فريق أورا 🙏`;
    case "RECALL":
      return `أهلين ${name} 🌿 صار وقت المراجعة الدورية لأسنانك بمركز أورا. بتحب نحجزلك موعد هالأسبوع؟`;
    case "REBOOK_MISSED":
      return `${name}، افتقدناك اليوم، إن شاء الله كل شي منيح؟ ولا يهمك، بتصير. خلينا نحجزلك موعد تاني: [اليوم والساعة] أو [اليوم والساعة]؟`;
    case "CUSTOM":
      return `أهلين ${name} 🌿`;
  }
}

/** Lead messages for the WhatsApp agent and the caller. */
export type LeadMessageKind = "FIRST_REPLY" | "OFFER_CALL" | "NO_REPLY_2H" | "MISSED_CALL" | "OUT_OF_HOURS";

export function leadMessage(kind: LeadMessageKind, ctx: MessageContext): string {
  const name = ctx.patientName;
  const interest = ctx.interest ? INTEREST_AR[ctx.interest] : "علاج الأسنان";
  switch (kind) {
    case "FIRST_REPLY":
      return `أهلاً وسهلاً ${name} 🌿 معك ${ctx.staffName ?? "[اسمك]"} من مركز أورا لطب الأسنان. شكراً لتواصلك معنا. خبرني، الاستفسار عن ${interest} إلك ولا لحدا من العيلة؟`;
    case "OFFER_CALL":
      return `تمام، فهمت عليك. أفضل شي يحكي معك زميلي من فريقنا 5 دقايق، بيفهم حالتك بالتفصيل وبيجاوبك على كل أسئلتك. إيمتى بيناسبك نتصل: اليوم ولا بكرا؟`;
    case "NO_REPLY_2H":
      return `${name}، حبيت أطمن إنه وصلتك رسالتي 🌿 إذا مشغول هلأ، بس خبرني أي وقت بيناسبك ومنحكي.`;
    case "MISSED_CALL":
      return `أهلين ${name} 🌿 حاولت إتصل فيك بالوقت اللي اتفقنا عليه وما زبط. إيمتى بيناسبك نحكي 5 دقايق؟`;
    case "OUT_OF_HOURS":
      return `أهلاً وسهلاً 🌿 وصلتنا رسالتك، وفريقنا بيرد عليك بكرا من الساعة 10 الصبح. إذا في وجع أو حالة طارئة، اكتبلنا "طارئ" ومنتواصل معك بأسرع وقت.`;
  }
}
