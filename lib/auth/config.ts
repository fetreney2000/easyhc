import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { Role } from "@/lib/db/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      role: Role;
      staffId: string;
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
    staffId: string;
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
    staffId: string;
    unitId?: string;
    jabatanId?: string;
    sessionVersion: number;
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

        await connectDB();

        const user = await User.findOne({
          username: (credentials.username as string).toLowerCase().trim(),
        })
          .select("+passwordHash +sessionVersion")
          .lean();

        if (!user) {
          return null;
        }

        if (user.status === "inactive") {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user._id.toString(),
          name: user.name,
          username: user.username,
          role: user.role,
          staffId: user.staffId,
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
      // On sign-in, populate the token
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.username = user.username;
        token.role = user.role;
        token.staffId = user.staffId;
        token.unitId = user.unitId;
        token.jabatanId = user.jabatanId;
        token.sessionVersion = user.sessionVersion;
      }

      // On session update (sliding window), extend the token
      if (trigger === "update") {
        // Re-validate sessionVersion against DB
        await connectDB();
        const dbUser = await User.findById(token.id)
          .select("sessionVersion status")
          .lean();
        if (!dbUser || dbUser.status === "inactive") {
          return {}; // Invalidate session
        }
        if (dbUser.sessionVersion !== token.sessionVersion) {
          return {}; // Session version mismatch, invalidate
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.id) {
        return session;
      }

      session.user = {
        id: token.id as string,
        name: token.name as string,
        username: token.username as string,
        role: token.role as Role,
        staffId: token.staffId as string,
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