import { randomBytes } from "node:crypto";
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

const STAFF: Array<{ email: string; name: string; role: Role }> = [
  { email: "admin@aura.local", name: "AURA Admin", role: Role.ADMIN },
  { email: "manager@aura.local", name: "Practice Manager", role: Role.PRACTICE_MANAGER },
  { email: "whatsapp@aura.local", name: "WhatsApp Desk", role: Role.RECEPTIONIST },
  { email: "calls@aura.local", name: "Call Centre", role: Role.RECEPTIONIST },
  { email: "reception@aura.local", name: "Reception", role: Role.RECEPTIONIST },
];

function oneTimePassword() {
  return randomBytes(9).toString("base64url");
}

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
      update: {},
      create: { id, practiceId: practice.id, name: type.name, defaultDurationMin: type.minutes, colorHex: type.color, sortOrder: i },
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
    const password = oneTimePassword();
    created.push({ email, name, password });
    return prisma.user.create({
      data: { email, name, role, practiceId: practice.id, passwordHash: await argon2.hash(password) },
    });
  }

  for (const staff of STAFF) await ensureUser(staff.email, staff.name, staff.role);

  for (let i = 0; i < AURA_PRACTITIONERS.length; i++) {
    const doctor = AURA_PRACTITIONERS[i];
    const user = await ensureUser(`${doctor.key}@aura.local`, doctor.name, Role.CLINICIAN);
    const id = `aura-practitioner-${doctor.key}`;
    await prisma.practitioner.upsert({
      where: { id },
      update: {},
      create: {
        id,
        practiceId: practice.id,
        userId: user.id,
        name: doctor.name,
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
    console.log("\nNew accounts (passwords are shown ONCE, write them down now):\n");
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
