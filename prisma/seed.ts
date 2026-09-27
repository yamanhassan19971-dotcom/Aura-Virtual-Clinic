import {
  PrismaClient,
  AppointmentStatus,
  Role,
  PatientStatus,
  PatientContactMethod,
  FamilyRelationType,
  MedicalAnswerValue,
  ClinicalNoteStatus,
  DocumentCategory,
  ClinicalImageCategory,
  TaskStatus,
  type Practitioner,
  type AppointmentType,
  type Patient,
} from "@prisma/client";
import argon2 from "argon2";
import { saveDocumentFile } from "../src/lib/documents/storage";
import { MEDICAL_QUESTIONS } from "../src/lib/medical/question-catalog";
import { PATIENT_FLAG_KEYS } from "../src/lib/patients/flag-catalog";
import { encodeReason } from "../src/lib/services/codec";

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
  const patientCount = 70;
  const CITIES = ["Damascus", "Aleppo", "Homs", "Lattakia", "Tartus", "Hama"];
  const ACQUISITION_SOURCES = ["GOOGLE", "INSTAGRAM", "FACEBOOK", "WHATSAPP", "REFERRAL", "EXISTING_PATIENT", "WALK_IN", "OTHER"];
  const CONTACT_METHODS: PatientContactMethod[] = [
    PatientContactMethod.PHONE,
    PatientContactMethod.WHATSAPP,
    PatientContactMethod.SMS,
    PatientContactMethod.EMAIL,
  ];
  const EMERGENCY_RELATIONSHIPS = ["Spouse", "Parent", "Sibling", "Child", "Friend"];
  const patients: Patient[] = [];
  for (let i = 0; i < patientCount; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const year = randInt(1948, 2020);
    const month = randInt(1, 12);
    const day = randInt(1, 28);
    const code = `A${pad(i + 1, 5)}`;
    const gender = i % 2 === 0 ? "Female" : "Male";
    const hasEmergencyContact = Math.random() < 0.6;
    // A handful of patients are archived/inactive so the list page and
    // "show archived" filter have something real to demonstrate.
    const status = i < 3 ? PatientStatus.ARCHIVED : i < 6 ? PatientStatus.INACTIVE : PatientStatus.ACTIVE;
    // Built once and used for both `create` and `update` so re-running the
    // seed against a database that already has these patient codes (from an
    // earlier run, possibly before some of these fields existed) still
    // converges on the documented demo data — an empty `update: {}` would
    // silently leave pre-existing rows (and their ARCHIVED/INACTIVE status)
    // untouched forever.
    const patientData = {
      practiceId: practice.id,
      patientCode: code,
      firstName,
      lastName,
      status,
      gender,
      preferredLanguage: Math.random() < 0.5 ? "Arabic" : "English",
      dateOfBirth: new Date(Date.UTC(year, month - 1, day)),
      phone: `+963 9${pad(randInt(10, 99))} ${pad(randInt(100, 999), 3)} ${pad(randInt(100, 999), 3)}`,
      homePhone: Math.random() < 0.3 ? `+963 11 ${pad(randInt(100, 999), 3)} ${pad(randInt(100, 999), 3)}` : null,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.test`,
      addressLine1: `${randInt(1, 200)} ${pick(["Al Thawra St", "Baghdad St", "Mezzeh Highway", "Shukri Al Quwatli Ave"])}`,
      city: pick(CITIES),
      country: "Syria",
      emergencyContactName: hasEmergencyContact ? `${pick(FIRST_NAMES)} ${lastName}` : null,
      emergencyContactRelationship: hasEmergencyContact ? pick(EMERGENCY_RELATIONSHIPS) : null,
      emergencyContactPhone: hasEmergencyContact
        ? `+963 9${pad(randInt(10, 99))} ${pad(randInt(100, 999), 3)} ${pad(randInt(100, 999), 3)}`
        : null,
      preferredPractitionerId: Math.random() < 0.6 ? pick(practitioners).id : null,
      acquisitionSource: pick(ACQUISITION_SOURCES),
      preferredContactMethod: pick(CONTACT_METHODS),
      recallPreference: Math.random() < 0.4 ? "6-month recall" : null,
      createdById: adminUser.id,
    };
    const patient = await prisma.patient.upsert({
      where: { patientCode: code },
      update: patientData,
      create: patientData,
    });
    patients.push(patient);
  }

  await prisma.auditLog.deleteMany({ where: {} });

  // Phase 2 records are regenerated fresh on every seed run — clear them
  // (children before parents, and before appointments are wiped below,
  // since ClinicalNote/PatientTask optionally reference an Appointment).
  await prisma.clinicalNoteAmendment.deleteMany({ where: {} });
  await prisma.clinicalNote.deleteMany({ where: {} });
  await prisma.clinicalNoteTemplate.deleteMany({ where: {} });
  await prisma.medicalHistoryAnswer.deleteMany({ where: {} });
  await prisma.medicalHistory.deleteMany({ where: {} });
  await prisma.medicalAlert.deleteMany({ where: {} });
  await prisma.patientDocument.deleteMany({ where: {} });
  await prisma.patientTask.deleteMany({ where: {} });
  await prisma.patientNote.deleteMany({ where: {} });
  await prisma.patientFlag.deleteMany({ where: {} });
  await prisma.patientFamilyRelationship.deleteMany({ where: {} });
  // Phase 3 records, same "regenerated fresh every run" approach —
  // ClinicalImage/BpeSextantScore first since they reference ChartEntry/BpeExam.
  await prisma.clinicalImage.deleteMany({ where: {} });
  await prisma.bpeSextantScore.deleteMany({ where: {} });
  await prisma.bpeExam.deleteMany({ where: {} });
  await prisma.chartEntry.deleteMany({ where: {} });

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

  // ---------------------------------------------------------------------
  // Phase 2: family links, medical history/alerts, clinical notes, admin
  // notes, documents, tasks, flags — varied scenarios across the patient
  // list so every tab of the patient record has something real to show.
  // ---------------------------------------------------------------------

  // Family relationships — cluster consecutive patients into small families
  // (a couple plus 1-2 children) rather than random pairs, so the "Family"
  // section on the Details tab reads naturally.
  let familyClusters = 0;
  for (let i = 6; i + 3 < patients.length && familyClusters < 10; i += 6) {
    const parentA = patients[i];
    const parentB = patients[i + 1];
    const childA = patients[i + 2];
    await prisma.patientFamilyRelationship.create({
      data: { patientId: parentA.id, relatedPatientId: parentB.id, relationType: FamilyRelationType.SPOUSE },
    });
    await prisma.patientFamilyRelationship.create({
      data: { patientId: parentA.id, relatedPatientId: childA.id, relationType: FamilyRelationType.PARENT },
    });
    if (Math.random() < 0.5 && i + 3 < patients.length) {
      const childB = patients[i + 3];
      await prisma.patientFamilyRelationship.create({
        data: { patientId: parentB.id, relatedPatientId: childB.id, relationType: FamilyRelationType.PARENT },
      });
    }
    familyClusters++;
  }

  // Clinical note templates — a couple of practice-wide, one personal.
  const noteTemplates = [
    {
      title: "Routine Examination",
      body: "Full mouth examination performed. No new caries detected. Oral hygiene: good. Recall in 6 months.",
      ownerUserId: null,
    },
    {
      title: "Scale & Polish",
      body: "Scale and polish completed. Gingival health improved since last visit. Advised on interdental brushing technique.",
      ownerUserId: null,
    },
    {
      title: "Composite Restoration",
      body: "Local anaesthetic administered, well tolerated. Composite restoration placed. Post-operative advice given.",
      ownerUserId: practitioners[0].userId,
    },
  ];
  for (const tpl of noteTemplates) {
    await prisma.clinicalNoteTemplate.create({ data: { practiceId: practice.id, ...tpl } });
  }

  // Medical history + alerts for ~70% of patients.
  const YES_NO_QUESTIONS = MEDICAL_QUESTIONS.filter((q) => q.type === "YES_NO");
  const FREE_TEXT_QUESTIONS = MEDICAL_QUESTIONS.filter((q) => q.type === "FREE_TEXT");
  const SELECT_QUESTIONS = MEDICAL_QUESTIONS.filter((q) => q.type === "SELECT");
  const SAMPLE_ALLERGY_DETAILS = ["Penicillin", "Latex gloves", "Ibuprofen", "Local anaesthetic (mild)"];
  const SAMPLE_MEDICATIONS = ["Metformin 500mg", "Aspirin 75mg daily", "Warfarin", "None reported"];

  let medicalHistoryCount = 0;
  let alertCount = 0;
  for (const patient of patients) {
    if (Math.random() >= 0.7) continue;

    const completedAt = new Date(Date.now() - randInt(0, 300) * 86400000);
    const history = await prisma.medicalHistory.create({
      data: {
        patientId: patient.id,
        status: "CURRENT",
        completedAt,
        completedById: adminUser.id,
        notes: Math.random() < 0.2 ? "Patient generally in good health, no concerns raised." : null,
      },
    });
    medicalHistoryCount++;

    for (const q of YES_NO_QUESTIONS) {
      if (Math.random() < 0.3) continue; // some questions left unanswered, like a real intake form
      const roll = Math.random();
      const answer: MedicalAnswerValue = roll < 0.12 ? MedicalAnswerValue.YES : roll < 0.92 ? MedicalAnswerValue.NO : MedicalAnswerValue.UNKNOWN;
      const freeText =
        answer === MedicalAnswerValue.YES && q.key.toLowerCase().includes("aller")
          ? pick(SAMPLE_ALLERGY_DETAILS)
          : null;
      await prisma.medicalHistoryAnswer.create({
        data: { medicalHistoryId: history.id, category: q.category, questionKey: q.key, answer, freeText },
      });
      if (q.alertOnYes && answer === MedicalAnswerValue.YES) {
        await prisma.medicalAlert.create({
          data: {
            patientId: patient.id,
            medicalHistoryId: history.id,
            label: encodeReason(q.key, freeText),
            createdById: adminUser.id,
          },
        });
        alertCount++;
      }
    }

    for (const q of FREE_TEXT_QUESTIONS) {
      if (Math.random() < 0.55) continue;
      await prisma.medicalHistoryAnswer.create({
        data: { medicalHistoryId: history.id, category: q.category, questionKey: q.key, freeText: pick(SAMPLE_MEDICATIONS) },
      });
    }

    for (const q of SELECT_QUESTIONS) {
      const option = pick(q.options ?? ["NEVER"]);
      await prisma.medicalHistoryAnswer.create({
        data: { medicalHistoryId: history.id, category: q.category, questionKey: q.key, freeText: option },
      });
      if (q.alertOnValues?.includes(option)) {
        await prisma.medicalAlert.create({
          data: {
            patientId: patient.id,
            medicalHistoryId: history.id,
            label: encodeReason(q.key, option),
            createdById: adminUser.id,
          },
        });
        alertCount++;
      }
    }
  }

  // A couple of manually-added, already-resolved alerts, to show the
  // resolved/soft-delete path is populated too (never visible as active).
  for (const patient of patients.slice(0, 2)) {
    await prisma.medicalAlert.create({
      data: {
        patientId: patient.id,
        label: "MANUAL::Reviewed at previous visit, no longer a concern",
        active: false,
        createdById: adminUser.id,
        resolvedAt: new Date(),
        resolvedById: adminUser.id,
      },
    });
  }

  // Clinical notes for ~55% of patients: 1-2 each, a mix of draft/signed,
  // with a couple of amendments on signed notes.
  const SAMPLE_NOTE_BODIES = [
    "Patient attended for routine check-up. No new complaints. BPE recorded, all sextants score 1. Oral hygiene instruction given.",
    "Presented with sensitivity on UL6. Examination revealed occlusal caries. Treatment plan discussed and agreed with patient.",
    "Composite restoration placed on LR4 under local anaesthetic. Patient tolerated the procedure well, no complications.",
    "Emergency attendance for dental pain. Diagnosed irreversible pulpitis on UR7. Referred for root canal treatment.",
    "Recall examination. Gingival health improved since last hygiene visit. Recall interval confirmed at 6 months.",
  ];
  let clinicalNoteCount = 0;
  for (const patient of patients) {
    if (Math.random() >= 0.55) continue;
    const noteRounds = randInt(1, 2);
    for (let n = 0; n < noteRounds; n++) {
      const practitioner = pick(practitioners);
      const createdAt = new Date(Date.now() - randInt(1, 250) * 86400000);
      const isSigned = Math.random() < 0.75;
      const note = await prisma.clinicalNote.create({
        data: {
          practiceId: practice.id,
          patientId: patient.id,
          practitionerId: practitioner.id,
          status: isSigned ? ClinicalNoteStatus.SIGNED : ClinicalNoteStatus.DRAFT,
          content: pick(SAMPLE_NOTE_BODIES),
          createdById: practitioner.userId ?? adminUser.id,
          createdAt,
          updatedAt: createdAt,
          signedAt: isSigned ? new Date(createdAt.getTime() + 10 * 60000) : null,
          signedById: isSigned ? (practitioner.userId ?? adminUser.id) : null,
        },
      });
      clinicalNoteCount++;
      if (isSigned && Math.random() < 0.25) {
        await prisma.clinicalNoteAmendment.create({
          data: {
            clinicalNoteId: note.id,
            content: "Correction: patient confirmed no known drug allergies (previously not recorded).",
            createdById: practitioner.userId ?? adminUser.id,
          },
        });
      }
    }
  }

  // Administrative (non-clinical) patient notes for ~30% of patients.
  const SAMPLE_ADMIN_NOTES = [
    "Prefers afternoon appointments due to work schedule.",
    "Requests reminder calls rather than SMS.",
    "Nervous patient — appreciates a slower, more detailed explanation before treatment.",
    "Usually brings a family member to appointments.",
    "Prefers Dr Yaman Hassan where possible.",
  ];
  let adminNoteCount = 0;
  for (const patient of patients) {
    if (Math.random() >= 0.3) continue;
    await prisma.patientNote.create({
      data: { patientId: patient.id, content: pick(SAMPLE_ADMIN_NOTES), createdById: adminUser.id },
    });
    adminNoteCount++;
  }

  // Documents — a small synthetic PNG "radiograph"/"photo" for ~20% of
  // patients, saved through the same storage helper the app uses, so
  // download/preview work identically to a real upload.
  const TINY_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  let documentCount = 0;
  for (const patient of patients) {
    if (Math.random() >= 0.2) continue;
    const category = pick(Object.values(DocumentCategory));
    const filename = `${category.toLowerCase()}-${patient.patientCode}.png`;
    const storageKey = await saveDocumentFile({
      practiceId: practice.id,
      patientId: patient.id,
      filename,
      buffer: TINY_PNG,
    });
    await prisma.patientDocument.create({
      data: {
        patientId: patient.id,
        filename,
        storageKey,
        mimeType: "image/png",
        sizeBytes: TINY_PNG.byteLength,
        category,
        uploadedById: adminUser.id,
      },
    });
    documentCount++;
  }

  // Tasks for ~25% of patients, a mix of open/in-progress/completed.
  const SAMPLE_TASKS = [
    "Call to confirm next appointment",
    "Follow up on outstanding lab work",
    "Send referral letter to specialist",
    "Confirm insurance pre-authorization",
    "Check in after treatment",
  ];
  const TASK_STATUSES = [TaskStatus.OPEN, TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED];
  let taskCount = 0;
  for (const patient of patients) {
    if (Math.random() >= 0.25) continue;
    const status = pick(TASK_STATUSES);
    await prisma.patientTask.create({
      data: {
        practiceId: practice.id,
        patientId: patient.id,
        title: pick(SAMPLE_TASKS),
        status,
        assignedToUserId: Math.random() < 0.6 ? adminUser.id : null,
        dueAt: new Date(Date.now() + randInt(-5, 14) * 86400000),
        createdById: adminUser.id,
        completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
      },
    });
    taskCount++;
  }

  // Flags for ~15% of patients.
  let flagCount = 0;
  for (const patient of patients) {
    if (Math.random() >= 0.15) continue;
    await prisma.patientFlag.create({
      data: {
        patientId: patient.id,
        flagKey: pick([...PATIENT_FLAG_KEYS]),
        createdById: adminUser.id,
      },
    });
    flagCount++;
  }

  // ---------------------------------------------------------------------
  // Phase 3: dedicated dental-chart demo patients (A-H per the Phase 3
  // brief), each illustrating one chart scenario clearly rather than
  // relying on the random patient pool above. Fixed patient codes/IDs so
  // re-seeding always converges on the same demo state.
  // ---------------------------------------------------------------------

  const chartDemoDob = (year: number) => new Date(Date.UTC(year, 5, 15));
  const drA = practitioners[0];
  const drB = practitioners[1];

  async function upsertChartDemoPatient(code: string, firstName: string, lastName: string, dob: Date) {
    const data = {
      practiceId: practice.id,
      patientCode: code,
      firstName,
      lastName,
      dateOfBirth: dob,
      status: PatientStatus.ACTIVE,
      gender: "Female",
      phone: `+963 9${pad(randInt(10, 99))} ${pad(randInt(100, 999), 3)} ${pad(randInt(100, 999), 3)}`,
      country: "Syria",
      city: "Damascus",
      createdById: adminUser.id,
    };
    return prisma.patient.upsert({ where: { patientCode: code }, update: data, create: data });
  }

  const chartPatientA = await upsertChartDemoPatient("P30001", "Noor", "Khalil", chartDemoDob(1988));
  const chartPatientB = await upsertChartDemoPatient("P30002", "Bilal", "Youssef", chartDemoDob(1975));
  const chartPatientC = await upsertChartDemoPatient("P30003", "Widad", "Saleh", chartDemoDob(1960));
  const chartPatientD = await upsertChartDemoPatient("P30004", "Diana", "Haddad", chartDemoDob(1982));
  const chartPatientE = await upsertChartDemoPatient("P30005", "Yara", "Suleiman", chartDemoDob(2018));
  const chartPatientF = await upsertChartDemoPatient("P30006", "Fadi", "Mansour", chartDemoDob(1979));
  const chartPatientG = await upsertChartDemoPatient("P30007", "Ghina", "Nasser", chartDemoDob(1991));
  const chartPatientH = await upsertChartDemoPatient("P30008", "Hadi", "Aziz", chartDemoDob(1995));

  type ChartEntrySeed = {
    toothNumber: string;
    dentitionType: "PERMANENT" | "DECIDUOUS";
    surface?: "MESIAL" | "DISTAL" | "OCCLUSAL" | "BUCCAL" | "LINGUAL";
    itemCode: string;
    status: "EXISTING" | "PLANNED" | "COMPLETED";
    daysAgo: number;
    note?: string;
  };

  async function seedChartEntries(patientId: string, practitionerId: string, entries: ChartEntrySeed[]) {
    let count = 0;
    for (const e of entries) {
      const recordedDate = new Date(Date.now() - e.daysAgo * 86400000);
      recordedDate.setHours(0, 0, 0, 0);
      await prisma.chartEntry.create({
        data: {
          practiceId: practice.id,
          patientId,
          toothNumber: e.toothNumber,
          dentitionType: e.dentitionType,
          surface: e.surface,
          itemCode: e.itemCode,
          status: e.status,
          recordedDate,
          practitionerId,
          note: e.note,
          completedAt: e.status === "COMPLETED" ? recordedDate : null,
          createdById: adminUser.id,
        },
      });
      count++;
    }
    return count;
  }

  let chartEntryCount = 0;

  // Patient A — healthy / mostly unremarkable chart, one small existing filling.
  chartEntryCount += await seedChartEntries(chartPatientA.id, drA.id, [
    { toothNumber: "16", dentitionType: "PERMANENT", surface: "OCCLUSAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 400 },
  ]);

  // Patient B — multiple restorations across several teeth/surfaces.
  chartEntryCount += await seedChartEntries(chartPatientB.id, drA.id, [
    { toothNumber: "16", dentitionType: "PERMANENT", surface: "MESIAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 900 },
    { toothNumber: "16", dentitionType: "PERMANENT", surface: "OCCLUSAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 900 },
    { toothNumber: "16", dentitionType: "PERMANENT", surface: "DISTAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 900 },
    { toothNumber: "26", dentitionType: "PERMANENT", surface: "OCCLUSAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 500 },
    { toothNumber: "36", dentitionType: "PERMANENT", surface: "OCCLUSAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 500 },
    { toothNumber: "36", dentitionType: "PERMANENT", surface: "DISTAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 500 },
    { toothNumber: "47", dentitionType: "PERMANENT", itemCode: "CROWN", status: "EXISTING", daysAgo: 200 },
  ]);

  // Patient C — missing teeth (both historic extractions and congenitally absent wisdom teeth).
  chartEntryCount += await seedChartEntries(chartPatientC.id, drB.id, [
    { toothNumber: "18", dentitionType: "PERMANENT", itemCode: "MISSING", status: "EXISTING", daysAgo: 3000, note: "Extracted — impacted." },
    { toothNumber: "28", dentitionType: "PERMANENT", itemCode: "MISSING", status: "EXISTING", daysAgo: 3000, note: "Extracted — impacted." },
    { toothNumber: "38", dentitionType: "PERMANENT", itemCode: "MISSING", status: "EXISTING", daysAgo: 2500 },
    { toothNumber: "48", dentitionType: "PERMANENT", itemCode: "MISSING", status: "EXISTING", daysAgo: 2500 },
    { toothNumber: "16", dentitionType: "PERMANENT", itemCode: "MISSING", status: "EXISTING", daysAgo: 1200, note: "Extracted due to extensive decay." },
  ]);

  // Patient D — existing crown following root canal treatment on the same tooth.
  chartEntryCount += await seedChartEntries(chartPatientD.id, drA.id, [
    { toothNumber: "46", dentitionType: "PERMANENT", itemCode: "ROOT_CANAL", status: "EXISTING", daysAgo: 700, note: "RCT completed prior to crown." },
    { toothNumber: "46", dentitionType: "PERMANENT", itemCode: "CROWN", status: "EXISTING", daysAgo: 650 },
    { toothNumber: "36", dentitionType: "PERMANENT", itemCode: "CROWN", status: "EXISTING", daysAgo: 900 },
  ]);

  // Patient E — mixed dentition (young patient with both deciduous and permanent teeth charted).
  chartEntryCount += await seedChartEntries(chartPatientE.id, drA.id, [
    { toothNumber: "84", dentitionType: "DECIDUOUS", surface: "OCCLUSAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 150 },
    { toothNumber: "74", dentitionType: "DECIDUOUS", surface: "OCCLUSAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 150 },
    { toothNumber: "55", dentitionType: "DECIDUOUS", itemCode: "MISSING", status: "EXISTING", daysAgo: 30, note: "Naturally exfoliated." },
    { toothNumber: "11", dentitionType: "PERMANENT", itemCode: "OTHER", status: "EXISTING", daysAgo: 30, note: "Newly erupted, monitoring." },
  ]);

  // Patient F — several planned treatments (not yet carried out).
  chartEntryCount += await seedChartEntries(chartPatientF.id, drB.id, [
    { toothNumber: "26", dentitionType: "PERMANENT", itemCode: "CROWN", status: "PLANNED", daysAgo: 5, note: "Planned following large existing restoration." },
    { toothNumber: "26", dentitionType: "PERMANENT", surface: "OCCLUSAL", itemCode: "FILLING", status: "EXISTING", daysAgo: 600 },
    { toothNumber: "37", dentitionType: "PERMANENT", surface: "MESIAL", itemCode: "FILLING", status: "PLANNED", daysAgo: 5 },
    { toothNumber: "11", dentitionType: "PERMANENT", surface: "MESIAL", itemCode: "VENEER", status: "PLANNED", daysAgo: 5 },
    { toothNumber: "48", dentitionType: "PERMANENT", itemCode: "MISSING", status: "PLANNED", daysAgo: 5, note: "Extraction planned — impacted." },
  ]);

  // Patient H — a couple of confirmed findings to give the images tab a chart to reference.
  chartEntryCount += await seedChartEntries(chartPatientH.id, drA.id, [
    { toothNumber: "26", dentitionType: "PERMANENT", surface: "OCCLUSAL", itemCode: "FILLING", status: "COMPLETED", daysAgo: 10 },
  ]);

  // Patient G — BPE history (two exams over time).
  const bpeExam1 = await prisma.bpeExam.create({
    data: {
      practiceId: practice.id,
      patientId: chartPatientG.id,
      practitionerId: drA.id,
      examDate: new Date(Date.now() - 400 * 86400000),
      notes: "Generalised mild gingivitis, reinforced oral hygiene instruction.",
      createdById: adminUser.id,
      scores: {
        create: [
          { sextant: "UPPER_RIGHT", code: "1" },
          { sextant: "UPPER_ANTERIOR", code: "1" },
          { sextant: "UPPER_LEFT", code: "2" },
          { sextant: "LOWER_RIGHT", code: "1" },
          { sextant: "LOWER_ANTERIOR", code: "0" },
          { sextant: "LOWER_LEFT", code: "1" },
        ],
      },
    },
  });
  const bpeExam2 = await prisma.bpeExam.create({
    data: {
      practiceId: practice.id,
      patientId: chartPatientG.id,
      practitionerId: drA.id,
      examDate: new Date(Date.now() - 30 * 86400000),
      notes: "Improved since last exam following scale and polish.",
      createdById: adminUser.id,
      scores: {
        create: [
          { sextant: "UPPER_RIGHT", code: "1" },
          { sextant: "UPPER_ANTERIOR", code: "0" },
          { sextant: "UPPER_LEFT", code: "1" },
          { sextant: "LOWER_RIGHT", code: "0" },
          { sextant: "LOWER_ANTERIOR", code: "0" },
          { sextant: "LOWER_LEFT", code: "1" },
        ],
      },
    },
  });
  const bpeExamCount = [bpeExam1, bpeExam2].length;

  // Patient H — clinical images/radiographs (reuses the same private file
  // storage helper the app uses, so download/preview work identically).
  let clinicalImageCount = 0;
  for (const spec of [
    { category: ClinicalImageCategory.RADIOGRAPH, toothNumber: "26", suffix: "radiograph" },
    { category: ClinicalImageCategory.INTRAORAL_PHOTO, toothNumber: null, suffix: "intraoral" },
  ] as const) {
    const filename = `${spec.suffix}-${chartPatientH.patientCode}.png`;
    const storageKey = await saveDocumentFile({
      practiceId: practice.id,
      patientId: chartPatientH.id,
      filename,
      buffer: TINY_PNG,
    });
    await prisma.clinicalImage.create({
      data: {
        patientId: chartPatientH.id,
        practiceId: practice.id,
        toothNumber: spec.toothNumber,
        category: spec.category,
        filename,
        storageKey,
        mimeType: "image/png",
        sizeBytes: TINY_PNG.byteLength,
        uploadedById: adminUser.id,
      },
    });
    clinicalImageCount++;
  }

  console.log("Seed complete:");
  console.log(`  Practice: ${practice.name}`);
  console.log(`  Practitioners: ${practitioners.length}`);
  console.log(`  Patients: ${patients.length}`);
  const apptCount = await prisma.appointment.count();
  console.log(`  Appointments: ${apptCount}`);
  console.log(`  Family relationships: ${familyClusters * 2}`);
  console.log(`  Medical histories: ${medicalHistoryCount} (alerts raised: ${alertCount})`);
  console.log(`  Clinical notes: ${clinicalNoteCount}`);
  console.log(`  Admin notes: ${adminNoteCount}`);
  console.log(`  Documents: ${documentCount}`);
  console.log(`  Tasks: ${taskCount}`);
  console.log(`  Flags: ${flagCount}`);
  console.log(`  Chart entries (demo patients A-H): ${chartEntryCount}`);
  console.log(`  BPE exams (demo patient G): ${bpeExamCount}`);
  console.log(`  Clinical images (demo patient H): ${clinicalImageCount}`);
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
