import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { Role } from "@/lib/db/types";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rateLimit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      role: Role;
      unitId?: string;
      jabatanId?: string;
      sessionVersion: number;
    };
  }

  interface User {
    id: string;
    name: string;
    username: string;
    role: Role;
    unitId?: string;
    jabatanId?: string;
    sessionVersion: number;
    email?: string | null;
    emailVerified?: Date | null;
  }

  interface JWT {
    id: string;
    name: string;
    username: string;
    role: Role;
    unitId?: string;
    jabatanId?: string;
    sessionVersion: number;
    /** Epoch ms of the last successful DB revocation check. */
    checkedAt?: number;
  }
}

/**
 * How long a token may go without re-checking the user against the DB.
 * Within this window a deactivated/deleted/password-reset user keeps working;
 * after it the next request revokes the token. Keep short.
 */
const REVOCATION_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Login throttling for a single account (see authorize below). */
const MAX_LOGIN_ATTEMPTS = 15;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Re-read the user from the DB and decide whether this token is still valid.
 * Returns the fresh { sessionVersion } when valid, or null when the session
 * must be revoked (user gone, inactive, or sessionVersion moved on).
 *
 * Fails CLOSED: any problem resolving the user means "revoked", so a
 * broken connection can never leave a deleted user with a working session.
 */
async function verifyTokenAgainstDb(
  id: unknown,
  sessionVersion: unknown
): Promise<{ sessionVersion: number } | null> {
  if (!id || typeof id !== "string") return null;

  try {
    await connectDB();
    const dbUser = await User.findById(id)
      .select("sessionVersion status")
      .lean();

    if (!dbUser || dbUser.status === "inactive") return null;
    if (dbUser.sessionVersion !== sessionVersion) return null;

    return { sessionVersion: dbUser.sessionVersion };
  } catch (error) {
    console.error("Auth: revocation check failed:", error);
    return null;
  }
}

export const {
  handlers,
  signIn,
  signOut,
  auth,
} = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = (credentials.username as string).toLowerCase().trim();

        // Per-account throttle: slows credential stuffing aimed at one user
        // even when the attacker rotates source IPs. Cleared on success.
        const throttleKey = `signin:user:${username}`;
        const throttle = checkRateLimit(
          throttleKey,
          MAX_LOGIN_ATTEMPTS,
          LOGIN_ATTEMPT_WINDOW_MS
        );
        if (!throttle.ok) {
          console.error("Auth: throttled login attempts for:", username);
          return null;
        }

        await connectDB();

        const user = await User.findOne({ username }).lean();

        if (!user) {
          console.error("Auth: user not found for username:", username);
          return null;
        }

        if (user.status === "inactive") {
          console.error("Auth: user is inactive:", username);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          console.error("Auth: password mismatch for user:", username);
          return null;
        }

        // Successful sign-in → give the account a clean window
        resetRateLimit(throttleKey);

        return {
          id: user._id.toString(),
          name: user.name,
          username: user.username,
          role: user.role,
          unitId: user.unitId?.toString(),
          jabatanId: user.jabatanId?.toString(),
          sessionVersion: user.sessionVersion,
          email: null,
          emailVerified: null,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 400 * 24 * 60 * 60, // 400 days (browser practical max)
    updateAge: 24 * 60 * 60, // Refresh every 24 hours (sliding window)
  },
  jwt: {
    maxAge: 400 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in, populate the token and start the revocation clock
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.username = user.username;
        token.role = user.role;
        token.unitId = user.unitId;
        token.jabatanId = user.jabatanId;
        token.sessionVersion = user.sessionVersion;
        token.checkedAt = Date.now();
        return token;
      }

      if (!token.id) {
        return {};
      }

      // Re-validate status + sessionVersion against the DB:
      //  - on every explicit session update (trigger === "update")
      //  - otherwise at most once per REVOCATION_CHECK_INTERVAL_MS
      const checkedAt = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      const stale = Date.now() - checkedAt > REVOCATION_CHECK_INTERVAL_MS;

      if (trigger === "update" || stale) {
        const fresh = await verifyTokenAgainstDb(token.id, token.sessionVersion);
        if (!fresh) {
          return {}; // Revoke: user deleted/deactivated or session version moved on
        }
        token.sessionVersion = fresh.sessionVersion;
        token.checkedAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (!token?.id || !token?.role) {
        // Revoked/invalid token → present as fully signed-out so both the
        // server layout and the client pages redirect to /login.
        (session as { user?: unknown }).user = undefined;
        return session;
      }

      session.user = {
        id: token.id as string,
        name: token.name as string,
        username: token.username as string,
        role: token.role as Role,
        unitId: token.unitId as string | undefined,
        jabatanId: token.jabatanId as string | undefined,
        sessionVersion: token.sessionVersion as number,
      } as typeof session.user;

      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
});