import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe config: no Node-only dependencies (argon2, Prisma) may be
// imported from this file, because it is also loaded by the proxy
// (middleware), which runs on the Edge runtime. Credential verification
// itself lives in auth.ts, which only ever runs in the Node.js runtime
// (API route handlers, server actions).
declare module "next-auth" {
  interface User {
    role: Role;
    practiceId: string;
    practitionerId: string | null;
    sessionVersion?: number;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      practiceId: string;
      practitionerId: string | null;
      sessionVersion: number;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    practiceId: string;
    practitionerId: string | null;
    sessionVersion?: number;
  }
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.practiceId = user.practiceId;
        token.practitionerId = user.practitionerId;
        token.sessionVersion = user.sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.practiceId = token.practiceId;
      session.user.practitionerId = token.practitionerId;
      session.user.sessionVersion = token.sessionVersion ?? 0;
      return session;
    },
  },
};
