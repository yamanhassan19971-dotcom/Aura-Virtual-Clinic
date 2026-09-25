// Code-defined, easily extended list of non-clinical patient flags. Kept
// deliberately separate from MedicalAlert — flags are operational
// (front-desk/communication concerns), alerts are clinical safety
// information, and the two must never be visually conflated.
export const PATIENT_FLAG_KEYS = [
  "VIP",
  "HIGH_ANXIETY",
  "INTERPRETER_REQUIRED",
  "COMMUNICATION_PREFERENCE",
  "OUTSTANDING_BALANCE",
  "CONSENT_REQUIRED",
] as const;

export type PatientFlagKey = (typeof PATIENT_FLAG_KEYS)[number];
