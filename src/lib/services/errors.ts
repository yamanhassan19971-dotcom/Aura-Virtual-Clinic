import type { Appointment } from "@prisma/client";

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
