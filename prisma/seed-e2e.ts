import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

// Deterministic, minimal fixture for Playwright E2E runs — no randomness,
// so specs can rely on exact names/counts. Intentionally has zero
// appointments: each spec books/moves/cancels what it needs through the UI,
// so tests never depend on fragile pre-seeded appointment IDs.
async function main() {
  await prisma.auditLog.deleteMany();

  // Phase 2 tables reference Patient (and some optionally reference
  // Appointment) — clear them first, children before parents, or the
  // Patient/Appointment deletes below hit a foreign key violation.
  await prisma.clinicalNoteAmendment.deleteMany();
  await prisma.clinicalNote.deleteMany();
  await prisma.clinicalImage.deleteMany();
  await prisma.bpeSextantScore.deleteMany();
  await prisma.bpeExam.deleteMany();
  await prisma.chartEntry.deleteMany();
  await prisma.clinicalNoteTemplate.deleteMany();
  await prisma.medicalHistoryAnswer.deleteMany();
  await prisma.medicalHistory.deleteMany();
  await prisma.medicalAlert.deleteMany();
  await prisma.patientDocument.deleteMany();
  await prisma.patientTask.deleteMany();
  await prisma.patientNote.deleteMany();
  await prisma.patientFlag.deleteMany();
  await prisma.patientFamilyRelationship.deleteMany();

  await prisma.appointmentStatusHistory.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.appointmentType.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.practitioner.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  await prisma.practice.deleteMany();

  const practice = await prisma.practice.create({ data: { id: "e2e-practice", name: "E2E Test Clinic" } });

  const roomA = await prisma.room.create({ data: { practiceId: practice.id, name: "Surgery 1" } });
  const roomB = await prisma.room.create({ data: { practiceId: practice.id, name: "Surgery 2" } });

  const drYaman = await prisma.practitioner.create({
    data: { practiceId: practice.id, name: "Dr Yaman Hassan", title: "Dentist", defaultRoomId: roomA.id, sortOrder: 0 },
  });
  const drAhmad = await prisma.practitioner.create({
    data: { practiceId: practice.id, name: "Dr Ahmad", title: "Dentist", defaultRoomId: roomB.id, sortOrder: 1 },
  });

  // Open every weekday 07:00-20:00 so the fixture works whatever day the
  // suite happens to run on, and slot math never hits an "outside hours"
  // edge case.
  for (let weekday = 0; weekday <= 6; weekday++) {
    await prisma.workingHours.create({
      data: { practiceId: practice.id, weekday, startMinute: 7 * 60, endMinute: 20 * 60 },
    });
  }

  await prisma.appointmentType.create({
    data: { practiceId: practice.id, name: "Examination", defaultDurationMin: 30, sortOrder: 0 },
  });
  await prisma.appointmentType.create({
    data: { practiceId: practice.id, name: "Root Canal", defaultDurationMin: 90, sortOrder: 1 },
  });
  await prisma.appointmentType.create({
    data: { practiceId: practice.id, name: "Hygiene", defaultDurationMin: 45, sortOrder: 2 },
  });

  await prisma.patient.create({
    data: {
      practiceId: practice.id,
      patientCode: "A00001",
      firstName: "Ahmed",
      lastName: "Hassan",
      dateOfBirth: new Date("1990-03-12"),
      phone: "+963900000001",
    },
  });
  await prisma.patient.create({
    data: {
      practiceId: practice.id,
      patientCode: "A00002",
      firstName: "Sara",
      lastName: "Ali",
      dateOfBirth: new Date("1988-07-04"),
      phone: "+963900000002",
    },
  });

  const passwordHash = await argon2.hash("Passw0rd!");
  await prisma.user.create({
    data: {
      practiceId: practice.id,
      email: "admin@aura.dev",
      name: "Admin User",
      role: Role.ADMIN,
      passwordHash,
    },
  });
  await prisma.user.create({
    data: {
      practiceId: practice.id,
      email: "reception@aura.dev",
      name: "Reception Desk",
      role: Role.RECEPTIONIST,
      passwordHash,
    },
  });
  await prisma.user.create({
    data: {
      practiceId: practice.id,
      email: "manager@aura.dev",
      name: "Practice Manager",
      role: Role.PRACTICE_MANAGER,
      passwordHash,
    },
  });
  await prisma.user.create({
    data: {
      practiceId: practice.id,
      email: "yaman@aura.dev",
      name: "Dr Yaman Hassan",
      role: Role.CLINICIAN,
      passwordHash,
      practitioner: { connect: { id: drYaman.id } },
    },
  });
  void drAhmad;

  console.log("E2E fixture seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
