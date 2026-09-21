import type { Role } from "@prisma/client";

export type Actor = {
  id: string;
  role: Role;
  practiceId: string;
  practitionerId: string | null;
};
