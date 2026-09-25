import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/services/actor";

export async function resetDb() {
  await prisma.auditLog.deleteMany();
  await prisma.clinicalNoteAmendment.deleteMany();
  await prisma.clinicalNote.deleteMany();
  await prisma.clinicalNoteTemplate.deleteMany();
  await prisma.patientTask.deleteMany();
  await prisma.patientDocument.deleteMany();
  await prisma.patientNote.deleteMany();
  await prisma.medicalAlert.deleteMany();
  await prisma.medicalHistoryAnswer.deleteMany();
  await prisma.medicalHistory.deleteMany();
  await prisma.patientFamilyRelationship.deleteMany();
  await prisma.patientFlag.deleteMany();
  await prisma.appointmentStatusHistory.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.appointmentType.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.practitioner.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  await prisma.practice.deleteMany();
}

export async function seedFixture() {
  const practice = await prisma.practice.create({ data: { name: "Test Clinic" } });
  const roomA = await prisma.room.create({ data: { practiceId: practice.id, name: "Surgery 1" } });
  const roomB = await prisma.room.create({ data: { practiceId: practice.id, name: "Surgery 2" } });

  const drA = await prisma.practitioner.create({
    data: { practiceId: practice.id, name: "Dr A", title: "Dentist", defaultRoomId: roomA.id },
  });
  const drB = await prisma.practitioner.create({
    data: { practiceId: practice.id, name: "Dr B", title: "Dentist", defaultRoomId: roomB.id },
  });

  const examType = await prisma.appointmentType.create({
    data: { practiceId: practice.id, name: "Examination", defaultDurationMin: 30 },
  });

  const patient1 = await prisma.patient.create({
    data: {
      practiceId: practice.id,
      patientCode: "A00001",
      firstName: "Ahmed",
      lastName: "Hassan",
      dateOfBirth: new Date("1990-01-01"),
      phone: "+963900000001",
    },
  });
  const patient2 = await prisma.patient.create({
    data: {
      practiceId: practice.id,
      patientCode: "A00002",
      firstName: "Sara",
      lastName: "Ali",
      dateOfBirth: new Date("1992-05-05"),
      phone: "+963900000002",
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      practiceId: practice.id,
      email: "admin@test.local",
      name: "Admin",
      role: "ADMIN",
      passwordHash: "unused",
    },
  });
  const receptionUser = await prisma.user.create({
    data: {
      practiceId: practice.id,
      email: "reception@test.local",
      name: "Reception",
      role: "RECEPTIONIST",
      passwordHash: "unused",
    },
  });
  const clinicianUser = await prisma.user.create({
    data: {
      practiceId: practice.id,
      email: "clinician@test.local",
      name: "Dr A",
      role: "CLINICIAN",
      passwordHash: "unused",
      practitioner: { connect: { id: drA.id } },
    },
  });
  const managerUser = await prisma.user.create({
    data: {
      practiceId: practice.id,
      email: "manager@test.local",
      name: "Manager",
      role: "PRACTICE_MANAGER",
      passwordHash: "unused",
    },
  });

  const actors: Record<string, Actor> = {
    admin: { id: adminUser.id, role: "ADMIN", practiceId: practice.id, practitionerId: null },
    reception: { id: receptionUser.id, role: "RECEPTIONIST", practiceId: practice.id, practitionerId: null },
    clinicianA: { id: clinicianUser.id, role: "CLINICIAN", practiceId: practice.id, practitionerId: drA.id },
    manager: { id: managerUser.id, role: "PRACTICE_MANAGER", practiceId: practice.id, practitionerId: null },
  };

  return { practice, roomA, roomB, drA, drB, examType, patient1, patient2, actors };
}
