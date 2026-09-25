import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import type { Actor } from "@/lib/services/actor";
import {
  ConflictError,
  DuplicatePatientError,
  InvalidTransitionError,
  NotFoundError,
  RecordLockedError,
} from "@/lib/services/errors";
import { PermissionError } from "@/lib/permissions";
import { InvalidDocumentFileError } from "@/lib/documents/storage";

export type ConflictInfo = {
  practitionerName: string;
  patientName: string;
  startTime: string;
  endTime: string;
};

export type DuplicatePatientInfo = {
  id: string;
  firstName: string;
  lastName: string;
  patientCode: string;
  dateOfBirth: string;
  phone: string | null;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind:
        | "VALIDATION"
        | "PERMISSION"
        | "NOT_FOUND"
        | "CONFLICT"
        | "INVALID_TRANSITION"
        | "DUPLICATE_PATIENT"
        | "RECORD_LOCKED"
        | "UNKNOWN";
      message: string;
      conflict?: ConflictInfo;
      duplicates?: DuplicatePatientInfo[];
    };

export async function requireActor(): Promise<Actor> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return {
    id: session.user.id,
    role: session.user.role,
    practiceId: session.user.practiceId,
    practitionerId: session.user.practitionerId,
  };
}

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return { ok: false, kind: "VALIDATION", message: "Some fields are invalid. Please check the form." };
    }
    if (error instanceof PermissionError) {
      return { ok: false, kind: "PERMISSION", message: "You don't have permission to do that." };
    }
    if (error instanceof NotFoundError) {
      return { ok: false, kind: "NOT_FOUND", message: error.message };
    }
    if (error instanceof InvalidTransitionError) {
      return { ok: false, kind: "INVALID_TRANSITION", message: error.message };
    }
    if (error instanceof ConflictError) {
      const c = error.conflictingAppointment;
      return {
        ok: false,
        kind: "CONFLICT",
        message: error.message,
        conflict: {
          practitionerName: c.practitioner.name,
          patientName: `${c.patient.firstName} ${c.patient.lastName}`,
          startTime: c.startTime.toISOString(),
          endTime: c.endTime.toISOString(),
        },
      };
    }
    if (error instanceof DuplicatePatientError) {
      return {
        ok: false,
        kind: "DUPLICATE_PATIENT",
        message: error.message,
        duplicates: error.possibleMatches.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          patientCode: p.patientCode,
          dateOfBirth: p.dateOfBirth.toISOString(),
          phone: p.phone,
        })),
      };
    }
    if (error instanceof RecordLockedError) {
      return { ok: false, kind: "RECORD_LOCKED", message: error.message };
    }
    if (error instanceof InvalidDocumentFileError) {
      return { ok: false, kind: "VALIDATION", message: error.message };
    }
    console.error("Unhandled action error", error);
    return { ok: false, kind: "UNKNOWN", message: "We couldn't save this. Please try again." };
  }
}
