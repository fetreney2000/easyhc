import { NextResponse } from "next/server";
import { handlers } from "@/lib/auth/config";
import { checkRateLimit, clientIp } from "@/lib/security/rateLimit";

type AuthRequest = Parameters<typeof handlers.POST>[0];

const SIGNIN_WINDOW_MS = 60 * 1000;
const SIGNIN_MAX_PER_MINUTE = 15;

export const GET = handlers.GET;

/** Absolute origin of this request, for building a client-parseable URL. */
function requestOrigin(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host");
  if (proto && host) return `${proto}://${host}`;
  try {
    return new URL(request.url).origin;
  } catch {
    return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  }
}

/**
 * Credential sign-ins are throttled per client IP (15/min). Other POSTs to
 * /api/auth (sign-out, session) are left alone so normal app use is never
 * blocked.
 */
export async function POST(request: Request) {
  const { pathname } = new URL(request.url);

  if (pathname.endsWith("/callback/credentials")) {
    const limit = checkRateLimit(
      `signin:${clientIp(request)}`,
      SIGNIN_MAX_PER_MINUTE,
      SIGNIN_WINDOW_MS
    );

    if (!limit.ok) {
      // next-auth's react client does `new URL(data.url)` on EVERY response
      // and reads the `error` param from it (redirect:false) — a bare
      // {error} JSON made it throw, so the login page showed the generic
      // server error instead of "too many attempts". Mimic the shape
      // next-auth itself returns for a failed credentials callback.
      return NextResponse.json(
        {
          url: `${requestOrigin(request)}/api/auth/signin?error=TooManyAttempts`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }
  }

  // The incoming App Router request is a NextRequest at runtime
  return handlers.POST(request as unknown as AuthRequest);
}
