import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";
import {
  AURA_APPOINTMENT_TYPES,
  AURA_CLOSE_MINUTE,
  AURA_OPEN_MINUTE,
  AURA_OPEN_WEEKDAYS,
  AURA_PRACTICE,
  AURA_PRACTITIONERS,
  AURA_PRICE_LIST,
  AURA_ROOMS,
} from "./aura-clinic-data";
import { generateTemporaryPassword } from "../src/lib/services/staff-service";

/**
 * Go-live setup for the real clinic: creates AURA's practice, rooms,
 * doctors, hours, appointment types, price list and staff logins, with NO
 * demo patients. Safe to re-run: configuration is upserted, existing logins
 * and their passwords are never touched, and only missing accounts are
 * created (their one-time passwords are printed once, here).
 *
 *   npm run db:setup-clinic
 */
const prisma = new PrismaClient();

// The clinic's people. Yaman is both the owner (Admin) and a doctor, so his
// login is also his diary column; the other doctors get Doctor logins below.
// Names are Arabic because patient messages say "معك {name}". More staff are
// added later in Settings → Staff Accounts.
const STAFF: Array<{ email: string; name: string; role: Role; doctorKey?: string }> = [
  { email: "yaman@aura.local", name: "يمان حسن", role: Role.ADMIN, doctorKey: "yaman" },
  { email: "raghad@aura.local", name: "رغد", role: Role.RECEPTIONIST },
  { email: "hanan@aura.local", name: "حنان", role: Role.RECEPTIONIST },
];

async function main() {
  const practice = await prisma.practice.upsert({
    where: { id: AURA_PRACTICE.id },
    update: { name: AURA_PRACTICE.name, timezone: AURA_PRACTICE.timezone },
    create: AURA_PRACTICE,
  });

  const rooms = [];
  for (let i = 0; i < AURA_ROOMS.length; i++) {
    const id = `aura-room-${i + 1}`;
    rooms.push(
      await prisma.room.upsert({ where: { id }, update: {}, create: { id, practiceId: practice.id, name: AURA_ROOMS[i] } })
    );
  }

  await prisma.workingHours.deleteMany({ where: { practiceId: practice.id, practitionerId: null } });
  for (const weekday of AURA_OPEN_WEEKDAYS) {
    await prisma.workingHours.create({
      data: { practiceId: practice.id, weekday, startMinute: AURA_OPEN_MINUTE, endMinute: AURA_CLOSE_MINUTE },
    });
  }

  for (let i = 0; i < AURA_APPOINTMENT_TYPES.length; i++) {
    const type = AURA_APPOINTMENT_TYPES[i];
    const id = `aura-apptype-${i}`;
    await prisma.appointmentType.upsert({
      where: { id },
      update: { postOpFollowUp: type.postOp ?? false },
      create: {
        id,
        practiceId: practice.id,
        name: type.name,
        defaultDurationMin: type.minutes,
        colorHex: type.color,
        sortOrder: i,
        postOpFollowUp: type.postOp ?? false,
      },
    });
  }

  for (let i = 0; i < AURA_PRICE_LIST.length; i++) {
    const item = AURA_PRICE_LIST[i];
    await prisma.treatmentCatalogItem.upsert({
      where: { practiceId_code: { practiceId: practice.id, code: item.code } },
      // Prices edited later in Settings are kept; only new items are added.
      update: {},
      create: {
        practiceId: practice.id,
        code: item.code,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        category: item.category,
        priceCents: item.priceUsd * 100,
        priceNote: item.priceNote ?? null,
        sortOrder: i,
      },
    });
  }

  const created: Array<{ email: string; name: string; password: string }> = [];
  async function ensureUser(email: string, name: string, role: Role) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    const password = generateTemporaryPassword();
    created.push({ email, name, password });
    return prisma.user.create({
      data: {
        email,
        name,
        role,
        practiceId: practice.id,
        passwordHash: await argon2.hash(password),
        // One-time password: the first sign-in asks for their own.
        mustChangePassword: true,
      },
    });
  }

  const staffUsers = new Map<string, { id: string }>();
  for (const staff of STAFF) {
    const user = await ensureUser(staff.email, staff.name, staff.role);
    if (staff.doctorKey) staffUsers.set(staff.doctorKey, user);
  }

  for (let i = 0; i < AURA_PRACTITIONERS.length; i++) {
    const doctor = AURA_PRACTITIONERS[i];
    const user =
      staffUsers.get(doctor.key) ?? (await ensureUser(`${doctor.key}@aura.local`, doctor.name, Role.CLINICIAN));
    const id = `aura-practitioner-${doctor.key}`;
    await prisma.practitioner.upsert({
      where: { id },
      update: { nameAr: doctor.nameAr },
      create: {
        id,
        practiceId: practice.id,
        userId: user.id,
        name: doctor.name,
        nameAr: doctor.nameAr,
        title: doctor.title,
        colorHex: doctor.color,
        defaultRoomId: rooms[i % rooms.length].id,
        sortOrder: i,
      },
    });
  }

  console.log(`AURA clinic ready: ${practice.name}`);
  if (created.length === 0) {
    console.log("All staff accounts already existed; no passwords were changed.");
  } else {
    console.log("\nNew accounts (passwords are shown ONCE, write them down now; each person");
    console.log("chooses their own password at first sign-in):\n");
    for (const c of created) console.log(`  ${c.email.padEnd(26)} ${c.password}   ${c.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
