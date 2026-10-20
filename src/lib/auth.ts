import NextAuth, { CredentialsSignin, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";
import { getLiveUser, verifySignIn } from "@/lib/services/staff-service";

/** Too many wrong passwords in a row; the login page says to wait instead of "incorrect". */
class AccountLockedError extends CredentialsSignin {
  code = "locked";
}

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const result = await verifySignIn(email, password);
        if (result.status === "locked") throw new AccountLockedError();
        if (result.status !== "ok") return null;
        const user = result.user;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          practiceId: user.practiceId,
          practitionerId: user.practitioner?.id ?? null,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
});

export const { handlers, signIn, signOut } = nextAuth;

/** The session as the signed cookie states it, without checking the database. */
export async function cookieSession(): Promise<Session | null> {
  return nextAuth.auth();
}

/**
 * The signed-in session, or null. The cookie stays valid for weeks, so this
 * also asks the database whether the account is still active and hasn't been
 * signed out since (role change, password reset, deactivation), and takes the
 * name and role from there. Every page, action and file route goes through it.
 */
export async function auth() {
  const session = await cookieSession();
  if (!session?.user) return null;
  const live = await getLiveUser(session.user.id, session.user.sessionVersion);
  if (!live) return null;
  return {
    ...session,
    user: {
      ...session.user,
      name: live.name,
      role: live.role,
      practitionerId: live.practitioner?.id ?? null,
      mustChangePassword: live.mustChangePassword,
    },
  };
}
