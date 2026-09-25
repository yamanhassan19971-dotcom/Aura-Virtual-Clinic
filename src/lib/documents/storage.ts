import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Private, non-public-served upload root — never inside `public/`. Ready to
// be swapped for an S3-compatible bucket later (saveDocumentFile /
// readDocumentFile are the only two functions that would need to change).
const STORAGE_ROOT = process.env.DOCUMENT_STORAGE_ROOT ?? path.join(process.cwd(), "storage", "patient-documents");

export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const SIGNATURES: Array<{ mimeType: string; extensions: string[]; matches: (buf: Buffer) => boolean }> = [
  {
    mimeType: "application/pdf",
    extensions: [".pdf"],
    matches: (buf) => buf.subarray(0, 5).toString("latin1") === "%PDF-",
  },
  {
    mimeType: "image/png",
    extensions: [".png"],
    matches: (buf) => buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mimeType: "image/jpeg",
    extensions: [".jpg", ".jpeg"],
    matches: (buf) => buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
];

export class InvalidDocumentFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocumentFileError";
  }
}

/**
 * Verifies the file's actual bytes (not just the browser-supplied MIME type
 * or the filename extension) match a known, safe document type, and
 * returns the canonical MIME type to store. Rejects anything else,
 * including executables renamed with a safe-looking extension.
 */
export function detectAndValidateType(filename: string, buffer: Buffer): string {
  const ext = path.extname(filename).toLowerCase();
  const signature = SIGNATURES.find((s) => s.matches(buffer));
  if (!signature) {
    throw new InvalidDocumentFileError("Unsupported or unrecognized file type.");
  }
  if (!signature.extensions.includes(ext)) {
    throw new InvalidDocumentFileError("The file extension doesn't match its actual content.");
  }
  return signature.mimeType;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
}

export async function saveDocumentFile(params: {
  practiceId: string;
  patientId: string;
  filename: string;
  buffer: Buffer;
}): Promise<string> {
  const dir = path.join(STORAGE_ROOT, params.practiceId, params.patientId);
  await mkdir(dir, { recursive: true });
  const storageKey = path.join(params.practiceId, params.patientId, `${randomUUID()}-${sanitizeFilename(params.filename)}`);
  await writeFile(path.join(STORAGE_ROOT, storageKey), params.buffer);
  return storageKey;
}

export async function readDocumentFile(storageKey: string): Promise<Buffer> {
  const resolved = path.join(STORAGE_ROOT, storageKey);
  if (!resolved.startsWith(path.join(STORAGE_ROOT))) {
    throw new InvalidDocumentFileError("Invalid file path.");
  }
  return readFile(resolved);
}
