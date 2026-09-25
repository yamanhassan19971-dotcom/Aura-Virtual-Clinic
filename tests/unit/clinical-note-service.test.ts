import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import {
  addNoteAmendment,
  createClinicalNote,
  signClinicalNote,
  updateClinicalNoteDraft,
} from "@/lib/services/clinical-note-service";
import { PermissionError } from "@/lib/permissions";
import { RecordLockedError } from "@/lib/services/errors";

async function fixture() {
  await resetDb();
  return seedFixture();
}

describe("clinical note service", () => {
  it("blocks a receptionist from creating clinical notes", async () => {
    const { actors, patient1, drA } = await fixture();
    await expect(
      createClinicalNote(actors.reception, { patientId: patient1.id, practitionerId: drA.id, content: "..." })
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("creates a draft, edits it, signs it, and freezes the content", async () => {
    const { actors, patient1, drA } = await fixture();

    const draft = await createClinicalNote(actors.clinicianA, {
      patientId: patient1.id,
      practitionerId: drA.id,
      content: "CC: routine check\nDx: pending",
    });
    expect(draft.status).toBe("DRAFT");

    const edited = await updateClinicalNoteDraft(actors.clinicianA, {
      noteId: draft.id,
      content: "CC: routine check\nDx: no caries found",
    });
    expect(edited.content).toContain("no caries found");

    const signed = await signClinicalNote(actors.clinicianA, { noteId: draft.id });
    expect(signed.status).toBe("SIGNED");
    expect(signed.signedById).toBe(actors.clinicianA.id);
    expect(signed.signedAt).not.toBeNull();

    // Editing a signed note directly must be rejected — corrections only via amendment.
    await expect(
      updateClinicalNoteDraft(actors.clinicianA, { noteId: draft.id, content: "tampered" })
    ).rejects.toBeInstanceOf(RecordLockedError);

    const reloaded = await prisma.clinicalNote.findUniqueOrThrow({ where: { id: draft.id } });
    expect(reloaded.content).toContain("no caries found");
    expect(reloaded.content).not.toBe("tampered");
  });

  it("preserves the original signed content when an amendment is added", async () => {
    const { actors, patient1, drA } = await fixture();

    const draft = await createClinicalNote(actors.clinicianA, {
      patientId: patient1.id,
      practitionerId: drA.id,
      content: "Original signed finding.",
    });
    await signClinicalNote(actors.clinicianA, { noteId: draft.id });

    const amendment = await addNoteAmendment(actors.clinicianA, {
      noteId: draft.id,
      content: "Correction: tooth 36, not 46.",
    });
    expect(amendment.content).toContain("tooth 36");

    const original = await prisma.clinicalNote.findUniqueOrThrow({ where: { id: draft.id } });
    expect(original.content).toBe("Original signed finding.");

    const amendments = await prisma.clinicalNoteAmendment.findMany({ where: { clinicalNoteId: draft.id } });
    expect(amendments).toHaveLength(1);
  });

  it("rejects amending a note that is still a draft", async () => {
    const { actors, patient1, drA } = await fixture();
    const draft = await createClinicalNote(actors.clinicianA, {
      patientId: patient1.id,
      practitionerId: drA.id,
      content: "Draft only.",
    });
    await expect(addNoteAmendment(actors.clinicianA, { noteId: draft.id, content: "x" })).rejects.toBeInstanceOf(
      RecordLockedError
    );
  });
});
