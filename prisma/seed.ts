import {
  PrismaClient,
  AppointmentStatus,
  Role,
  type Practitioner,
  type AppointmentType,
  type Patient,
} from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const DEV_PASSWORD = "Passw0rd!";

const FIRST_NAMES = [
  "Ahmed", "Omar", "Yusuf", "Khalid", "Hassan", "Mahmoud", "Bilal", "Karim",
  "Tarek", "Sami", "Fadi", "Rami", "Nabil", "Zaid", "Anas", "Hadi",
  "Layla", "Rana", "Dina", "Maya", "Nour", "Salma", "Rasha", "Hala",
  "Yasmin", "Lina", "Reem", "Ghina", "Zeina", "Amal", "Mariam", "Sara",
  "Fatima", "Aisha", "Huda", "Iman", "Jana", "Lara", "Nada", "Rania",
  "Samer", "Wael", "Adel", "Basil",
];
const LAST_NAMES = [
  "Hassan", "Ali", "Khalil", "Mansour", "Saleh", "Haddad", "Nasser", "Aziz",
  "Youssef", "Karam", "Sabbagh", "Rahal", "Homsi", "Halabi", "Qassem",
  "Zein", "Sultan", "Barakat", "Najjar", "Ghanem", "Attar", "Suleiman",
];

const APPOINTMENT_TYPES: Array<{ name: string; minutes: number; color: string }> = [
  { name: "Examination", minutes: 30, color: "#3B82F6" },
  { name: "Emergency", minutes: 30, color: "#DC2626" },
  { name: "Hygiene", minutes: 45, color: "#0EA5E9" },
  { name: "Composite", minutes: 30, color: "#8B5CF6" },
  { name: "Crown", minutes: 60, color: "#B45309" },
  { name: "Bridge", minutes: 90, color: "#92400E" },
  { name: "Root Canal", minutes: 90, color: "#BE123C" },
  { name: "Extraction", minutes: 45, color: "#7C2D12" },
  { name: "Consultation", minutes: 20, color: "#0F766E" },
  { name: "Follow-up", minutes: 15, color: "#4B5563" },
  { name: "Whitening", minutes: 60, color: "#CA8A04" },
  { name: "Other", minutes: 30, color: "#6B7280" },
];

const PRACTITIONERS = [
  { name: "Dr Yaman Hassan", title: "Dentist", color: "#0F2747", email: "yaman@aura.dev" },
  { name: "Dr Ahmad", title: "Dentist", color: "#1D4ED8", email: "ahmad@aura.dev" },
  { name: "Dr Sara", title: "Dentist", color: "#7C3AED", email: "sara@aura.dev" },
  { name: "Dr Omar", title: "Dentist", color: "#0F766E", email: "omar@aura.dev" },
  { name: "Hygienist Lina", title: "Hygienist", color: "#B45309", email: "lina@aura.dev" },
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function dateAt(base: Date, hours: number, minutes: number): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding AURA demo data...");

  const practice = await prisma.practice.upsert({
    where: { id: "practice-damascus-main" },
    update: {},
    create: {
      id: "practice-damascus-main",
      name: "Damascus Main Clinic",
      timezone: "Asia/Damascus",
    },
  });

  const rooms = await Promise.all(
    [1, 2, 3, 4].map((n) =>
      prisma.room.upsert({
        where: { id: `room-surgery-${n}` },
        update: {},
        create: { id: `room-surgery-${n}`, practiceId: practice.id, name: `Surgery ${n}` },
      })
    )
  );

  const passwordHash = await argon2.hash(DEV_PASSWORD);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@aura.dev" },
    update: {},
    create: {
      email: "admin@aura.dev",
      name: "Admin User",
      role: Role.ADMIN,
      practiceId: practice.id,
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: "manager@aura.dev" },
    update: {},
    create: {
      email: "manager@aura.dev",
      name: "Practice Manager",
      role: Role.PRACTICE_MANAGER,
      practiceId: practice.id,
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: "reception@aura.dev" },
    update: {},
    create: {
      email: "reception@aura.dev",
      name: "Reception Desk",
      role: Role.RECEPTIONIST,
      practiceId: practice.id,
      passwordHash,
    },
  });

  const practitioners: Practitioner[] = [];
  for (let i = 0; i < PRACTITIONERS.length; i++) {
    const spec = PRACTITIONERS[i];
    const clinicianUser = await prisma.user.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        email: spec.email,
        name: spec.name,
        role: Role.CLINICIAN,
        practiceId: practice.id,
        passwordHash,
      },
    });
    const practitioner = await prisma.practitioner.upsert({
      where: { id: `practitioner-${i}` },
      update: {},
      create: {
        id: `practitioner-${i}`,
        practiceId: practice.id,
        userId: clinicianUser.id,
        name: spec.name,
        title: spec.title,
        colorHex: spec.color,
        defaultRoomId: rooms[i % rooms.length].id,
        sortOrder: i,
      },
    });
    practitioners.push(practitioner);
  }

  // Practice-wide working hours: Monday-Friday 08:00-18:00.
  await prisma.workingHours.deleteMany({ where: { practiceId: practice.id, practitionerId: null } });
  for (const weekday of [1, 2, 3, 4, 5]) {
    await prisma.workingHours.create({
      data: { practiceId: practice.id, weekday, startMinute: 8 * 60, endMinute: 18 * 60 },
    });
  }

  const appointmentTypes: AppointmentType[] = [];
  for (let i = 0; i < APPOINTMENT_TYPES.length; i++) {
    const t = APPOINTMENT_TYPES[i];
    const type = await prisma.appointmentType.upsert({
      where: { id: `apptype-${i}` },
      update: {},
      create: {
        id: `apptype-${i}`,
        practiceId: practice.id,
        name: t.name,
        defaultDurationMin: t.minutes,
        colorHex: t.color,
        sortOrder: i,
      },
    });
    appointmentTypes.push(type);
  }

  // Patients
  const patientCount = 44;
  const patients: Patient[] = [];
  for (let i = 0; i < patientCount; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const year = randInt(1948, 2020);
    const month = randInt(1, 12);
    const day = randInt(1, 28);
    const code = `A${pad(i + 1, 5)}`;
    const patient = await prisma.patient.upsert({
      where: { patientCode: code },
      update: {},
      create: {
        practiceId: practice.id,
        patientCode: code,
        firstName,
        lastName,
        dateOfBirth: new Date(Date.UTC(year, month - 1, day)),
        phone: `+963 9${pad(randInt(10, 99))} ${pad(randInt(100, 999), 3)} ${pad(randInt(100, 999), 3)}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.test`,
      },
    });
    patients.push(patient);
  }

  await prisma.auditLog.deleteMany({ where: {} });
  await prisma.appointmentStatusHistory.deleteMany({ where: {} });
  await prisma.appointment.deleteMany({ where: {} });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Anchor used to decide "already happened / happening now / upcoming" for
  // the demo distribution. Clamped to a lively mid-morning point so the
  // seeded day always reads as a busy practice in progress, regardless of
  // the real time the seed script happens to run at.
  const now = new Date();
  const anchorMinutes = now.getHours() * 60 + now.getMinutes();
  const nowAnchor = anchorMinutes >= 8 * 60 && anchorMinutes <= 17 * 60 ? anchorMinutes : 12 * 60 + 30;

  let patientCursor = 0;
  function nextPatient() {
    const p = patients[patientCursor % patients.length];
    patientCursor++;
    return p;
  }

  async function recordHistory(
    appointmentId: string,
    transitions: Array<{ status: AppointmentStatus; at: Date; reason?: string; byUserId?: string }>
  ) {
    let previous: AppointmentStatus | null = null;
    for (const t of transitions) {
      await prisma.appointmentStatusHistory.create({
        data: {
          appointmentId,
          previousStatus: previous,
          newStatus: t.status,
          changedById: t.byUserId ?? adminUser.id,
          changedAt: t.at,
          reason: t.reason,
        },
      });
      previous = t.status;
    }
  }

  async function createDayAppointments(day: Date, opts: { count: number; bias: "past" | "today" | "future" }) {
    for (const practitioner of practitioners) {
      const room = rooms.find((r) => r.id === practitioner.defaultRoomId) ?? rooms[0];
      let cursorMinute = 8 * 60 + randInt(0, 30);
      const perPractitioner = Math.ceil(opts.count / practitioners.length);
      for (let i = 0; i < perPractitioner; i++) {
        if (cursorMinute > 17 * 60) break;
        // Occasionally skip a slot to leave a visible gap in the diary.
        if (Math.random() < 0.18) {
          cursorMinute += 30;
          continue;
        }
        const type = pick(appointmentTypes);
        const duration = type.defaultDurationMin;
        if (cursorMinute + duration > 18 * 60) break;

        const startTime = dateAt(day, Math.floor(cursorMinute / 60), cursorMinute % 60);
        const endTime = new Date(startTime.getTime() + duration * 60000);
        const patient = nextPatient();

        let status: AppointmentStatus = AppointmentStatus.PENDING;
        let arrivedAt: Date | null = null;
        let inSurgeryAt: Date | null = null;
        let completedAt: Date | null = null;
        let cancelledAt: Date | null = null;
        let ftaAt: Date | null = null;
        let cancellationReason: string | null = null;
        let ftaReason: string | null = null;
        const transitions: Array<{ status: AppointmentStatus; at: Date; reason?: string }> = [
          { status: AppointmentStatus.PENDING, at: new Date(startTime.getTime() - 3 * 86400000) },
        ];

        if (opts.bias === "past") {
          const roll = Math.random();
          if (roll < 0.08) {
            status = AppointmentStatus.CANCELLED;
            cancelledAt = new Date(startTime.getTime() - 4 * 3600000);
            cancellationReason = pick(["Patient cancelled", "Clinic cancelled", "Rescheduled"]);
            transitions.push({ status, at: cancelledAt, reason: cancellationReason });
          } else if (roll < 0.16) {
            status = AppointmentStatus.FTA;
            ftaAt = new Date(startTime.getTime() + 5 * 60000);
            ftaReason = pick(["Did not attend", "No response", "Forgot appointment"]);
            transitions.push(
              { status: AppointmentStatus.CONFIRMED, at: new Date(startTime.getTime() - 3600000) },
              { status, at: ftaAt, reason: ftaReason }
            );
          } else {
            status = AppointmentStatus.COMPLETED;
            arrivedAt = new Date(startTime.getTime() - randInt(4, 12) * 60000);
            inSurgeryAt = new Date(arrivedAt.getTime() + randInt(3, 10) * 60000);
            completedAt = new Date(endTime.getTime() - randInt(0, 5) * 60000);
            transitions.push(
              { status: AppointmentStatus.CONFIRMED, at: new Date(startTime.getTime() - 3600000) },
              { status: AppointmentStatus.ARRIVED, at: arrivedAt },
              { status: AppointmentStatus.IN_SURGERY, at: inSurgeryAt },
              { status: AppointmentStatus.COMPLETED, at: completedAt }
            );
          }
        } else if (opts.bias === "future") {
          status = Math.random() < 0.6 ? AppointmentStatus.CONFIRMED : AppointmentStatus.PENDING;
          if (status === AppointmentStatus.CONFIRMED) {
            transitions.push({ status, at: new Date() });
          }
        } else {
          // today: derive status from where the slot sits relative to nowAnchor
          if (endTime.getHours() * 60 + endTime.getMinutes() <= nowAnchor - 10) {
            const roll = Math.random();
            if (roll < 0.06) {
              status = AppointmentStatus.CANCELLED;
              cancelledAt = new Date(startTime.getTime() - 3 * 3600000);
              cancellationReason = pick(["Patient cancelled", "Clinic cancelled", "Rescheduled"]);
              transitions.push({ status, at: cancelledAt, reason: cancellationReason });
            } else if (roll < 0.12) {
              status = AppointmentStatus.FTA;
              ftaAt = new Date(startTime.getTime() + 5 * 60000);
              ftaReason = pick(["Did not attend", "No response"]);
              transitions.push(
                { status: AppointmentStatus.CONFIRMED, at: new Date(startTime.getTime() - 3600000) },
                { status, at: ftaAt, reason: ftaReason }
              );
            } else {
              status = AppointmentStatus.COMPLETED;
              arrivedAt = new Date(startTime.getTime() - randInt(4, 12) * 60000);
              inSurgeryAt = new Date(arrivedAt.getTime() + randInt(3, 10) * 60000);
              completedAt = new Date(endTime.getTime() - randInt(0, 5) * 60000);
              transitions.push(
                { status: AppointmentStatus.CONFIRMED, at: new Date(startTime.getTime() - 3600000) },
                { status: AppointmentStatus.ARRIVED, at: arrivedAt },
                { status: AppointmentStatus.IN_SURGERY, at: inSurgeryAt },
                { status: AppointmentStatus.COMPLETED, at: completedAt }
              );
            }
          } else if (
            startTime.getHours() * 60 + startTime.getMinutes() <= nowAnchor &&
            endTime.getHours() * 60 + endTime.getMinutes() > nowAnchor
          ) {
            const roll = Math.random();
            if (roll < 0.5) {
              status = AppointmentStatus.IN_SURGERY;
              arrivedAt = new Date(startTime.getTime() - randInt(5, 10) * 60000);
              inSurgeryAt = new Date(startTime.getTime() + randInt(1, 6) * 60000);
              transitions.push(
                { status: AppointmentStatus.CONFIRMED, at: new Date(startTime.getTime() - 3600000) },
                { status: AppointmentStatus.ARRIVED, at: arrivedAt },
                { status: AppointmentStatus.IN_SURGERY, at: inSurgeryAt }
              );
            } else {
              status = AppointmentStatus.ARRIVED;
              arrivedAt = new Date(startTime.getTime() - randInt(2, 9) * 60000);
              transitions.push(
                { status: AppointmentStatus.CONFIRMED, at: new Date(startTime.getTime() - 3600000) },
                { status: AppointmentStatus.ARRIVED, at: arrivedAt }
              );
            }
          } else if (startTime.getHours() * 60 + startTime.getMinutes() - nowAnchor <= 90) {
            status = Math.random() < 0.7 ? AppointmentStatus.CONFIRMED : AppointmentStatus.ARRIVED;
            if (status === AppointmentStatus.ARRIVED) {
              arrivedAt = new Date(now.getTime() - randInt(1, 6) * 60000);
              transitions.push(
                { status: AppointmentStatus.CONFIRMED, at: new Date(startTime.getTime() - 3600000) },
                { status: AppointmentStatus.ARRIVED, at: arrivedAt }
              );
            } else {
              transitions.push({ status, at: new Date(startTime.getTime() - 3600000) });
            }
          } else {
            status = Math.random() < 0.55 ? AppointmentStatus.CONFIRMED : AppointmentStatus.PENDING;
            if (status === AppointmentStatus.CONFIRMED) {
              transitions.push({ status, at: new Date(startTime.getTime() - 7200000) });
            }
          }
        }

        const appt = await prisma.appointment.create({
          data: {
            practiceId: practice.id,
            patientId: patient.id,
            practitionerId: practitioner.id,
            roomId: room.id,
            appointmentTypeId: type.id,
            date: day,
            startTime,
            endTime,
            durationMin: duration,
            status,
            notes: Math.random() < 0.25 ? "Routine visit, no known allergies." : null,
            arrivedAt,
            inSurgeryAt,
            completedAt,
            cancelledAt,
            ftaAt,
            cancellationReason,
            ftaReason,
            createdById: adminUser.id,
          },
        });
        await recordHistory(appt.id, transitions);
        await prisma.auditLog.create({
          data: {
            userId: adminUser.id,
            action: "appointment.created",
            recordType: "Appointment",
            recordId: appt.id,
            newValue: { status, startTime, practitionerId: practitioner.id },
          },
        });

        cursorMinute += duration;
      }
    }
  }

  await createDayAppointments(yesterday, { count: 14, bias: "past" });
  await createDayAppointments(today, { count: 50, bias: "today" });
  await createDayAppointments(tomorrow, { count: 16, bias: "future" });

  // Guarantee every status is represented at least once today, regardless
  // of how the probabilistic distribution above happened to land, so the
  // summary strip / status filters always have something to demonstrate.
  {
    const existingPending = await prisma.appointment.findFirst({
      where: { date: today, status: AppointmentStatus.PENDING },
    });
    if (!existingPending) {
      const candidate = await prisma.appointment.findFirst({
        where: { date: today, status: AppointmentStatus.CONFIRMED },
        orderBy: { startTime: "desc" },
      });
      if (candidate) {
        await prisma.appointment.update({
          where: { id: candidate.id },
          data: { status: AppointmentStatus.PENDING },
        });
        await recordHistory(candidate.id, [{ status: AppointmentStatus.PENDING, at: new Date() }]);
      }
    }
  }

  for (const status of [AppointmentStatus.FTA, AppointmentStatus.CANCELLED] as const) {
    const existing = await prisma.appointment.findFirst({ where: { date: today, status } });
    if (!existing) {
      const candidate = await prisma.appointment.findFirst({
        where: { date: today, status: AppointmentStatus.COMPLETED },
        orderBy: { startTime: "asc" },
      });
      if (candidate) {
        const at = new Date(candidate.startTime.getTime() + 5 * 60000);
        const reason =
          status === AppointmentStatus.FTA ? "Did not attend" : "Patient cancelled";
        await prisma.appointment.update({
          where: { id: candidate.id },
          data:
            status === AppointmentStatus.FTA
              ? {
                  status,
                  ftaAt: at,
                  ftaReason: reason,
                  arrivedAt: null,
                  inSurgeryAt: null,
                  completedAt: null,
                }
              : { status, cancelledAt: at, cancellationReason: reason, arrivedAt: null, inSurgeryAt: null, completedAt: null },
        });
        await recordHistory(candidate.id, [{ status, at, reason }]);
      }
    }
  }

  console.log("Seed complete:");
  console.log(`  Practice: ${practice.name}`);
  console.log(`  Practitioners: ${practitioners.length}`);
  console.log(`  Patients: ${patients.length}`);
  const apptCount = await prisma.appointment.count();
  console.log(`  Appointments: ${apptCount}`);
  console.log(`  Demo login password for all seeded users: ${DEV_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
