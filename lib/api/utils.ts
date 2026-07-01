import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { connectDB } from "@/lib/db/mongoose";
import { Role } from "@/lib/db/types";
import { can, Action } from "@/lib/auth/rbac";

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
  if (!session?.user) {
    return null;
  }
  return session.user as AuthUser;
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

type ApiHandler = (
  request: Request,
  user: AuthUser,
  ctx?: Record<string, unknown>
) => Promise<NextResponse>;

/**
 * Higher-order function for API routes that require authentication + optional RBAC check.
 */
export function withAuth(handler: ApiHandler, requiredAction?: Action) {
  return async (request: Request, ctx?: Record<string, unknown>) => {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorized();
    }

    if (requiredAction && !can(user.role, requiredAction)) {
      return forbidden();
    }

    await connectDB();
    return handler(request, user, ctx);
  };
}