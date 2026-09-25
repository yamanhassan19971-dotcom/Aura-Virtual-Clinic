// Code-defined medical-history question catalog. This is the "configurable
// fields" the Phase 2 brief asks for — the question set can grow by adding
// entries here (no migration needed, since answers are stored generically
// as category/questionKey/answer/freeText rows), while still being a single
// reviewable source of truth instead of scattered hard-coded form fields.
//
// Every question's label/i18n text lives under
// medical.questions.<key>.label in the message catalogs — this file only
// carries structure and clinical alert behaviour.

export const MEDICAL_CATEGORIES = [
  "GENERAL_HEALTH",
  "MEDICATIONS",
  "ALLERGIES",
  "CARDIOVASCULAR",
  "RESPIRATORY",
  "ENDOCRINE",
  "BLEEDING",
  "INFECTIOUS_DISEASE",
  "PREGNANCY",
  "SMOKING",
  "ALCOHOL",
  "OTHER",
] as const;

export type MedicalCategory = (typeof MEDICAL_CATEGORIES)[number];

export type MedicalQuestionType = "YES_NO" | "FREE_TEXT" | "SELECT";

export type MedicalQuestionDef = {
  key: string;
  category: MedicalCategory;
  type: MedicalQuestionType;
  options?: string[]; // SELECT only
  /** For YES_NO: an answer of YES creates/reaffirms a medical alert. For SELECT: alertOnValues lists the options that do. */
  alertOnYes?: boolean;
  alertOnValues?: string[];
};

export const MEDICAL_QUESTIONS: MedicalQuestionDef[] = [
  { key: "underMedicalCare", category: "GENERAL_HEALTH", type: "YES_NO" },
  { key: "recentHospitalization", category: "GENERAL_HEALTH", type: "YES_NO" },
  { key: "chronicConditions", category: "GENERAL_HEALTH", type: "YES_NO", alertOnYes: true },

  { key: "currentMedications", category: "MEDICATIONS", type: "FREE_TEXT" },
  { key: "anticoagulants", category: "MEDICATIONS", type: "YES_NO", alertOnYes: true },
  { key: "bisphosphonates", category: "MEDICATIONS", type: "YES_NO", alertOnYes: true },
  { key: "steroids", category: "MEDICATIONS", type: "YES_NO", alertOnYes: true },
  { key: "otherMedications", category: "MEDICATIONS", type: "FREE_TEXT" },

  { key: "drugAllergies", category: "ALLERGIES", type: "YES_NO", alertOnYes: true },
  { key: "foodAllergies", category: "ALLERGIES", type: "YES_NO", alertOnYes: true },
  { key: "latexAllergy", category: "ALLERGIES", type: "YES_NO", alertOnYes: true },
  { key: "otherAllergies", category: "ALLERGIES", type: "FREE_TEXT" },

  { key: "heartDisease", category: "CARDIOVASCULAR", type: "YES_NO", alertOnYes: true },
  { key: "hypertension", category: "CARDIOVASCULAR", type: "YES_NO", alertOnYes: true },
  { key: "previousHeartAttack", category: "CARDIOVASCULAR", type: "YES_NO", alertOnYes: true },
  { key: "otherCardiovascular", category: "CARDIOVASCULAR", type: "FREE_TEXT" },

  { key: "asthma", category: "RESPIRATORY", type: "YES_NO", alertOnYes: true },
  { key: "copd", category: "RESPIRATORY", type: "YES_NO", alertOnYes: true },
  { key: "otherRespiratory", category: "RESPIRATORY", type: "FREE_TEXT" },

  { key: "diabetes", category: "ENDOCRINE", type: "YES_NO", alertOnYes: true },
  { key: "thyroidDisease", category: "ENDOCRINE", type: "YES_NO", alertOnYes: true },
  { key: "otherEndocrine", category: "ENDOCRINE", type: "FREE_TEXT" },

  { key: "bleedingDisorder", category: "BLEEDING", type: "YES_NO", alertOnYes: true },
  { key: "excessiveBleedingAfterSurgery", category: "BLEEDING", type: "YES_NO", alertOnYes: true },

  { key: "infectiousDisease", category: "INFECTIOUS_DISEASE", type: "YES_NO", alertOnYes: true },

  { key: "pregnant", category: "PREGNANCY", type: "YES_NO", alertOnYes: true },
  { key: "breastfeeding", category: "PREGNANCY", type: "YES_NO" },

  {
    key: "smokingStatus",
    category: "SMOKING",
    type: "SELECT",
    options: ["NEVER", "FORMER", "CURRENT"],
    alertOnValues: ["CURRENT"],
  },

  { key: "alcoholConsumption", category: "ALCOHOL", type: "FREE_TEXT" },

  { key: "otherMedicalInformation", category: "OTHER", type: "FREE_TEXT" },
];

export const MEDICAL_QUESTION_BY_KEY = new Map(MEDICAL_QUESTIONS.map((q) => [q.key, q]));

export function questionsByCategory(): Array<{ category: MedicalCategory; questions: MedicalQuestionDef[] }> {
  return MEDICAL_CATEGORIES.map((category) => ({
    category,
    questions: MEDICAL_QUESTIONS.filter((q) => q.category === category),
  }));
}
