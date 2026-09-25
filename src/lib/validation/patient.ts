import { z } from "zod";

// Used by the quick "+ New Patient" flow inside booking — deliberately thin.
export const newPatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.coerce.date(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  overrideDuplicateCheck: z.boolean().optional(),
});
export type NewPatientInput = z.infer<typeof newPatientSchema>;

export const checkDuplicatesSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.coerce.date().optional(),
  phone: z.string().max(40).optional().nullable(),
});
export type CheckDuplicatesInput = z.infer<typeof checkDuplicatesSchema>;

const optionalString = (max: number) => z.string().max(max).optional().nullable();

// Full Details-tab edit — every field optional so a partial save only
// touches what changed; the service diffs against the existing row for the
// audit entry.
export const updatePatientDetailsSchema = z.object({
  patientId: z.string().min(1),
  firstName: z.string().min(1).max(100).optional(),
  middleName: optionalString(100),
  lastName: z.string().min(1).max(100).optional(),
  preferredName: optionalString(100),
  title: optionalString(20),
  gender: optionalString(30),
  dateOfBirth: z.coerce.date().optional(),
  preferredLanguage: optionalString(10),

  phone: optionalString(40),
  homePhone: optionalString(40),
  workPhone: optionalString(40),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  addressLine1: optionalString(200),
  addressLine2: optionalString(200),
  city: optionalString(100),
  country: optionalString(100),
  postalCode: optionalString(20),

  emergencyContactName: optionalString(150),
  emergencyContactRelationship: optionalString(60),
  emergencyContactPhone: optionalString(40),
  emergencyContactNotes: optionalString(500),

  preferredPractitionerId: z.string().optional().nullable(),
  acquisitionSource: optionalString(60),
  preferredContactMethod: z.enum(["PHONE", "WHATSAPP", "SMS", "EMAIL"]).optional().nullable(),
  recallPreference: optionalString(60),
});
export type UpdatePatientDetailsInput = z.infer<typeof updatePatientDetailsSchema>;

export const setPatientStatusSchema = z.object({
  patientId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
});

export const familyRelationTypeSchema = z.enum(["SPOUSE", "PARENT", "CHILD", "SIBLING", "GUARDIAN", "OTHER"]);

export const linkFamilySchema = z.object({
  patientId: z.string().min(1),
  relatedPatientId: z.string().min(1),
  relationType: familyRelationTypeSchema,
});

export const unlinkFamilySchema = z.object({
  relationshipId: z.string().min(1),
});
