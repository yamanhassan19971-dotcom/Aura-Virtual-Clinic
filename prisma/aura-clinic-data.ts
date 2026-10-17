// AURA Dental Clinic's real configuration: one source of truth for the demo
// seed (seed.ts) and the go-live setup (setup-clinic.ts). Prices are USD and
// all-inclusive except radiology, as quoted in the call-centre playbooks.

export const AURA_PRACTICE = {
  id: "practice-aura-jdeidet-artouz",
  name: "AURA Dental Clinic — Jdeidet Artouz",
  timezone: "Asia/Damascus",
};

// Room names are placeholders until the clinic confirms its surgeries.
export const AURA_ROOMS = ["Surgery 1", "Surgery 2", "Surgery 3"];

export const AURA_PRACTITIONERS = [
  { key: "yaman", name: "Dr Yaman Hassan", nameAr: "د. يمان", title: "Dentist", color: "#0F2747" },
  { key: "wajih", name: "Dr Wajih Jahjah", nameAr: "د. وجيه", title: "Oral & Maxillofacial Surgeon", color: "#1D4ED8" },
  { key: "amr", name: "Dr Amr Odeh", nameAr: "د. عمرو", title: "Orthodontist", color: "#7C3AED" },
  { key: "adham", name: "Dr Adham Farroukh", nameAr: "د. أدهم", title: "Endodontist & Restorative", color: "#0F766E" },
  { key: "abeer", name: "Dr Abeer Al-Rifai", nameAr: "د. عبير", title: "Paediatric Dentist", color: "#B45309" },
];

// 10:00-20:00 every day; Friday (weekday 5) closed except emergencies.
export const AURA_OPEN_WEEKDAYS = [0, 1, 2, 3, 4, 6];
export const AURA_OPEN_MINUTE = 10 * 60;
export const AURA_CLOSE_MINUTE = 20 * 60;

// postOp: completing one of these schedules the post-treatment check-ins
// (WhatsApp the same evening, a call the next day, WhatsApp a few days later).
export const AURA_APPOINTMENT_TYPES: Array<{ name: string; minutes: number; color: string; postOp?: boolean }> = [
  { name: "Free Consultation", minutes: 30, color: "#0F766E" },
  { name: "Examination", minutes: 30, color: "#3B82F6" },
  { name: "Emergency", minutes: 30, color: "#DC2626" },
  { name: "Implant Surgery", minutes: 90, color: "#1D4ED8", postOp: true },
  { name: "4D Smile Surgery", minutes: 240, color: "#0F2747", postOp: true },
  { name: "Digital Impressions", minutes: 45, color: "#6366F1" },
  { name: "Prosthesis Delivery", minutes: 60, color: "#B45309", postOp: true },
  { name: "Orthodontic Visit", minutes: 30, color: "#7C3AED" },
  { name: "Smile Design / Mock-up", minutes: 60, color: "#CA8A04" },
  { name: "Veneers Preparation", minutes: 120, color: "#A16207", postOp: true },
  { name: "Root Canal", minutes: 90, color: "#BE123C", postOp: true },
  { name: "Filling", minutes: 45, color: "#8B5CF6" },
  { name: "Extraction", minutes: 45, color: "#7C2D12", postOp: true },
  { name: "Hygiene", minutes: 45, color: "#0EA5E9" },
  { name: "Child Visit", minutes: 30, color: "#F59E0B" },
  { name: "Follow-up", minutes: 15, color: "#4B5563" },
];

export const AURA_PRICE_LIST: Array<{
  code: string;
  nameEn: string;
  nameAr: string;
  category: string;
  priceUsd: number;
  priceNote?: string;
}> = [
  { code: "CONSULTATION", nameEn: "Consultation & assessment", nameAr: "استشارة وتقييم", category: "General", priceUsd: 0, priceNote: "Free" },
  { code: "SURGICAL_EXTRACTION", nameEn: "Surgical extraction", nameAr: "قلع جراحي", category: "General", priceUsd: 20, priceNote: "Included when implanting" },

  { code: "IMPLANT_ROOT", nameEn: "Root implant (Swiss)", nameAr: "زرعة Root السويسرية", category: "Implants", priceUsd: 200, priceNote: "Per implant, without crown" },
  { code: "IMPLANT_SGS", nameEn: "SGS implant", nameAr: "زرعة SGS", category: "Implants", priceUsd: 300, priceNote: "Per implant, without crown" },
  { code: "IMPLANT_STRAUMANN", nameEn: "Straumann implant (Swiss premium)", nameAr: "زرعة Straumann السويسرية", category: "Implants", priceUsd: 0, priceNote: "Price set by the doctor at consultation" },
  { code: "IMPLANT_CROWN", nameEn: "Crown on implant (zirconia/porcelain)", nameAr: "تاج على زرعة (زيركون/بورسلان)", category: "Implants", priceUsd: 40 },
  { code: "BONE_GRAFT", nameEn: "Bone graft / sinus lift", nameAr: "تطعيم عظمي / رفع جيب", category: "Implants", priceUsd: 0, priceNote: "Price set by the doctor" },

  { code: "4D_ROOT4_JAW", nameEn: "4D Smile · Root ×4 · one jaw", nameAr: "ابتسامة 4D · Root ×4 · فك واحد", category: "4D Smile", priceUsd: 1300 },
  { code: "4D_ROOT4_BOTH", nameEn: "4D Smile · Root ×4 · both jaws", nameAr: "ابتسامة 4D · Root ×4 · الفكين", category: "4D Smile", priceUsd: 2500 },
  { code: "4D_ROOT6_JAW", nameEn: "4D Smile · Root ×6 · one jaw", nameAr: "ابتسامة 4D · Root ×6 · فك واحد", category: "4D Smile", priceUsd: 1650 },
  { code: "4D_ROOT6_BOTH", nameEn: "4D Smile · Root ×6 · both jaws", nameAr: "ابتسامة 4D · Root ×6 · الفكين", category: "4D Smile", priceUsd: 3200 },
  { code: "4D_SGS4_JAW", nameEn: "4D Smile · SGS ×4 · one jaw", nameAr: "ابتسامة 4D · SGS ×4 · فك واحد", category: "4D Smile", priceUsd: 1900 },
  { code: "4D_SGS4_BOTH", nameEn: "4D Smile · SGS ×4 · both jaws", nameAr: "ابتسامة 4D · SGS ×4 · الفكين", category: "4D Smile", priceUsd: 3500 },
  { code: "4D_SGS6_JAW", nameEn: "4D Smile · SGS ×6 · one jaw", nameAr: "ابتسامة 4D · SGS ×6 · فك واحد", category: "4D Smile", priceUsd: 2400 },
  { code: "4D_SGS6_BOTH", nameEn: "4D Smile · SGS ×6 · both jaws", nameAr: "ابتسامة 4D · SGS ×6 · الفكين", category: "4D Smile", priceUsd: 4500 },

  { code: "ORTHO_METAL", nameEn: "Orthodontics · metal braces", nameAr: "تقويم · معدني", category: "Orthodontics", priceUsd: 700, priceNote: "$700-1000 depending on the case" },
  { code: "ORTHO_CLEAR", nameEn: "Orthodontics · clear braces", nameAr: "تقويم · شفاف", category: "Orthodontics", priceUsd: 1000, priceNote: "$700-1000 depending on the case" },

  { code: "VENEER_EMAX", nameEn: "Hollywood Smile · E.max veneer", nameAr: "ابتسامة هوليود · فينير E.max", category: "Hollywood Smile", priceUsd: 90, priceNote: "Per tooth; 8 teeth package $640" },
  { code: "VENEER_ZIRCONIA", nameEn: "Hollywood Smile · zirconia", nameAr: "ابتسامة هوليود · زيركون", category: "Hollywood Smile", priceUsd: 90, priceNote: "Per tooth; 8 teeth package $640" },
  { code: "VENEER_8_PACKAGE", nameEn: "Hollywood Smile · 8 teeth (E.max/zirconia)", nameAr: "ابتسامة هوليود · 8 أسنان (E.max/زيركون)", category: "Hollywood Smile", priceUsd: 640, priceNote: "Includes smile design, temporaries and follow-up" },
  { code: "COMPOSITE_VENEER", nameEn: "Hollywood Smile · direct composite", nameAr: "ابتسامة هوليود · كومبوزيت مباشر", category: "Hollywood Smile", priceUsd: 30, priceNote: "Per tooth (~450,000 old SYP)" },
];
