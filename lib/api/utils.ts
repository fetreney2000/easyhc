import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { Role } from "@/lib/db/types";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  unitId?: string;
  jabatanId?: string;
  sessionVersion: number;
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const session = await auth();
  const user = session?.user;
  // A revoked token is served with `user === undefined`; require the full
  // payload (id + role) before treating the caller as authenticated.
  if (!user || !user.id || !user.role) {
    return null;
  }
  return user as AuthUser;
}

/**
 * Constant-time secret comparison. Fails closed when either side is missing.
 * Both values are hashed first so the comparison is fixed-length regardless
 * of the input lengths (no length oracle).
 */
export function secureCompare(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) return false;

  const digest = (value: string) =>
    crypto.createHash("sha256").update(value, "utf8").digest();

  return crypto.timingSafeEqual(digest(provided), digest(expected));
}

/**
 * Extract a `Bearer <secret>` token from an Authorization header.
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Escape a user-supplied string so it can be safely embedded in a RegExp.
 * Prevents both malformed queries and pathological (ReDoS) patterns.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function unauthorized() {
  return NextResponse.json(
    { error: "Anda tidak mempunyai kebenaran untuk tindakan ini" },
    { status: 401 }
  );
}

export function forbidden() {
  return NextResponse.json(
    { error: "Akses ditolak" },
    { status: 403 }
  );
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message = "Ralat pelayan dalaman") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function success(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
