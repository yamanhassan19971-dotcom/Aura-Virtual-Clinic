import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { newPatientSchema } from "@/lib/validation/appointment";

async function nextPatientCode(practiceId: string): Promise<string> {
  const last = await prisma.patient.findFirst({
    where: { practiceId },
    orderBy: { patientCode: "desc" },
    select: { patientCode: true },
  });
  const lastNumber = last ? parseInt(last.patientCode.replace(/\D/g, ""), 10) : 0;
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
  return `A${String(next).padStart(5, "0")}`;
}

export async function createPatient(actor: Actor, rawInput: unknown) {
  const input = newPatientSchema.parse(rawInput);
  assertCan(actor.role, "patients.create");

  const patientCode = await nextPatientCode(actor.practiceId);

  return prisma.patient.create({
    data: {
      practiceId: actor.practiceId,
      patientCode,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      phone: input.phone || null,
      email: input.email || null,
    },
  });
}
