import type { Appointment, Patient } from "@prisma/client";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  conflictingAppointment: Appointment & {
    patient: { firstName: string; lastName: string };
    practitioner: { name: string };
  };
  constructor(
    conflictingAppointment: Appointment & {
      patient: { firstName: string; lastName: string };
      practitioner: { name: string };
    }
  ) {
    super("This appointment overlaps with another appointment.");
    this.name = "ConflictError";
    this.conflictingAppointment = conflictingAppointment;
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot change status from ${from} to ${to}.`);
    this.name = "InvalidTransitionError";
  }
}

export class DuplicatePatientError extends Error {
  possibleMatches: Patient[];
  constructor(possibleMatches: Patient[]) {
    super("A similar patient record may already exist.");
    this.name = "DuplicatePatientError";
    this.possibleMatches = possibleMatches;
  }
}

export class RecordLockedError extends Error {
  constructor(message = "This record has been signed/locked and can no longer be edited directly.") {
    super(message);
    this.name = "RecordLockedError";
  }
}
