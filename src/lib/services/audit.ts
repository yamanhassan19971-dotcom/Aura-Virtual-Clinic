import type { Prisma } from "@prisma/client";

/** JSON-sanitizes a Prisma row (Date -> ISO string, etc.) for storage in AuditLog's Json columns. */
export function serialize(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

/**
 * The one place every Phase 1 and Phase 2 service writes an audit trail
 * entry from. Always called inside the same transaction as the mutation it
 * describes, never after — a mutation without a matching audit row is a bug.
 */
export async function writeAudit(
  tx: Prisma.TransactionClient,
  params: {
    userId: string | null | undefined;
    action: string;
    recordType: string;
    recordId: string;
    previousValue: unknown;
    newValue: unknown;
  }
) {
  await tx.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      recordType: params.recordType,
      recordId: params.recordId,
      previousValue: params.previousValue === null ? undefined : (params.previousValue as Prisma.InputJsonValue),
      newValue: params.newValue === null ? undefined : (params.newValue as Prisma.InputJsonValue),
    },
  });
}
