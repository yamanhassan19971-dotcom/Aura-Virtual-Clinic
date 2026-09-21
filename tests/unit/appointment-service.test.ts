import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import {
  cancelAppointment,
  changeStatus,
  createAppointment,
  markFta,
  updateAppointment,
} from "@/lib/services/appointment-service";
import { ConflictError, InvalidTransitionError, NotFoundError } from "@/lib/services/errors";
import { PermissionError } from "@/lib/permissions";

async function fixture() {
  await resetDb();
  return seedFixture();
}

function at(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe("appointment service", () => {
  beforeEach(async () => {
    // resetDb is called per-test via fixture() to keep tests independent.
  });

  it("creates a pending appointment in the correct slot", async () => {
    const { drA, roomA, examType, patient1, actors } = await fixture();

    const appt = await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 30,
    });

    expect(appt.status).toBe("PENDING");
    expect(appt.practitionerId).toBe(drA.id);
    expect(appt.endTime.getTime() - appt.startTime.getTime()).toBe(30 * 60000);

    const history = await prisma.appointmentStatusHistory.findMany({ where: { appointmentId: appt.id } });
    expect(history).toHaveLength(1);
    expect(history[0].newStatus).toBe("PENDING");

    const audit = await prisma.auditLog.findMany({ where: { recordId: appt.id } });
    expect(audit.some((a) => a.action === "appointment.created")).toBe(true);
  });

  it("detects a scheduling conflict for the same practitioner and blocks it", async () => {
    const { drA, roomA, roomB, examType, patient1, patient2, actors } = await fixture();

    await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 60,
    });

    await expect(
      createAppointment(actors.reception, {
        patientId: patient2.id,
        practitionerId: drA.id,
        roomId: roomB.id,
        appointmentTypeId: examType.id,
        startTime: at(9, 30),
        durationMin: 30,
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects a conflict override from a receptionist but allows it for a practice manager", async () => {
    const { drA, roomA, roomB, examType, patient1, patient2, actors, practice } = await fixture();

    await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 60,
    });

    await expect(
      createAppointment(actors.reception, {
        patientId: patient2.id,
        practitionerId: drA.id,
        roomId: roomB.id,
        appointmentTypeId: examType.id,
        startTime: at(9, 30),
        durationMin: 30,
        overrideConflict: true,
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const managerUser = await prisma.user.create({
      data: {
        practiceId: practice.id,
        email: "manager@test.local",
        name: "Manager",
        role: "PRACTICE_MANAGER",
        passwordHash: "unused",
      },
    });
    const manager = { id: managerUser.id, role: "PRACTICE_MANAGER" as const, practiceId: practice.id, practitionerId: null };

    const overridden = await createAppointment(manager, {
      patientId: patient2.id,
      practitionerId: drA.id,
      roomId: roomB.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 30),
      durationMin: 30,
      overrideConflict: true,
      overrideReason: "Emergency squeeze-in",
    });

    expect(overridden.conflictOverride).toBe(true);
    expect(overridden.conflictOverrideById).toBe(managerUser.id);
  });

  it("moves an appointment to a new time/practitioner and logs it", async () => {
    const { drA, drB, roomA, roomB, examType, patient1, actors } = await fixture();

    const appt = await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 30,
    });

    const moved = await updateAppointment(actors.reception, {
      appointmentId: appt.id,
      practitionerId: drB.id,
      roomId: roomB.id,
      startTime: at(10, 0),
    });

    expect(moved.practitionerId).toBe(drB.id);
    expect(moved.startTime.getHours()).toBe(10);
    expect(moved.endTime.getHours()).toBe(10);
    expect(moved.endTime.getMinutes()).toBe(30);

    const audit = await prisma.auditLog.findMany({ where: { recordId: appt.id, action: "appointment.moved" } });
    expect(audit).toHaveLength(1);
  });

  it("resizes an appointment by changing only the duration", async () => {
    const { drA, roomA, examType, patient1, actors } = await fixture();

    const appt = await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 30,
    });

    const resized = await updateAppointment(actors.reception, {
      appointmentId: appt.id,
      durationMin: 60,
    });

    expect(resized.durationMin).toBe(60);
    expect(resized.endTime.getTime() - resized.startTime.getTime()).toBe(60 * 60000);

    const audit = await prisma.auditLog.findMany({ where: { recordId: appt.id, action: "appointment.resized" } });
    expect(audit).toHaveLength(1);
  });

  it("walks an appointment through the full status journey with timestamps", async () => {
    const { drA, roomA, examType, patient1, actors } = await fixture();

    const appt = await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 30,
      status: "PENDING",
    });

    const confirmed = await changeStatus(actors.reception, { appointmentId: appt.id, status: "CONFIRMED" });
    expect(confirmed.status).toBe("CONFIRMED");

    const arrived = await changeStatus(actors.reception, { appointmentId: appt.id, status: "ARRIVED" });
    expect(arrived.status).toBe("ARRIVED");
    expect(arrived.arrivedAt).not.toBeNull();

    const inSurgery = await changeStatus(actors.reception, { appointmentId: appt.id, status: "IN_SURGERY" });
    expect(inSurgery.inSurgeryAt).not.toBeNull();

    const completed = await changeStatus(actors.reception, { appointmentId: appt.id, status: "COMPLETED" });
    expect(completed.completedAt).not.toBeNull();

    const history = await prisma.appointmentStatusHistory.findMany({
      where: { appointmentId: appt.id },
      orderBy: { changedAt: "asc" },
    });
    expect(history.map((h) => h.newStatus)).toEqual(["PENDING", "CONFIRMED", "ARRIVED", "IN_SURGERY", "COMPLETED"]);

    await expect(changeStatus(actors.reception, { appointmentId: appt.id, status: "PENDING" })).rejects.toBeInstanceOf(
      InvalidTransitionError
    );
  });

  it("marks FTA and keeps the appointment visible with its reason stored", async () => {
    const { drA, roomA, examType, patient1, actors } = await fixture();

    const appt = await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 30,
    });

    const fta = await markFta(actors.reception, {
      appointmentId: appt.id,
      reason: "DID_NOT_ATTEND",
      notes: "No call, no show",
    });

    expect(fta.status).toBe("FTA");
    expect(fta.ftaReason).toBe("DID_NOT_ATTEND::No call, no show");
    expect(fta.ftaAt).not.toBeNull();

    const stillThere = await prisma.appointment.findUnique({ where: { id: appt.id } });
    expect(stillThere).not.toBeNull();
  });

  it("cancels an appointment and keeps it visible, marked cancelled", async () => {
    const { drA, roomA, examType, patient1, actors } = await fixture();

    const appt = await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 30,
    });

    const cancelled = await cancelAppointment(actors.reception, {
      appointmentId: appt.id,
      reason: "PATIENT_CANCELLED",
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();

    const stillThere = await prisma.appointment.findUnique({ where: { id: appt.id } });
    expect(stillThere?.status).toBe("CANCELLED");
  });

  it("blocks a clinician from creating appointments but allows status changes on their own patients only", async () => {
    const { drA, drB, roomA, roomB, examType, patient1, patient2, actors } = await fixture();

    await expect(
      createAppointment(actors.clinicianA, {
        patientId: patient1.id,
        practitionerId: drA.id,
        roomId: roomA.id,
        appointmentTypeId: examType.id,
        startTime: at(9, 0),
        durationMin: 30,
      })
    ).rejects.toBeInstanceOf(PermissionError);

    const own = await createAppointment(actors.reception, {
      patientId: patient1.id,
      practitionerId: drA.id,
      roomId: roomA.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 30,
    });
    const someoneElses = await createAppointment(actors.reception, {
      patientId: patient2.id,
      practitionerId: drB.id,
      roomId: roomB.id,
      appointmentTypeId: examType.id,
      startTime: at(9, 0),
      durationMin: 30,
    });

    const updated = await changeStatus(actors.clinicianA, { appointmentId: own.id, status: "CONFIRMED" });
    expect(updated.status).toBe("CONFIRMED");

    await expect(
      changeStatus(actors.clinicianA, { appointmentId: someoneElses.id, status: "CONFIRMED" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
