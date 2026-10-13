import { NextResponse } from "next/server";
import { handlers } from "@/lib/auth/config";
import { checkRateLimit, clientIp } from "@/lib/security/rateLimit";

type AuthRequest = Parameters<typeof handlers.POST>[0];

const SIGNIN_WINDOW_MS = 60 * 1000;
const SIGNIN_MAX_PER_MINUTE = 15;

export const GET = handlers.GET;

/**
 * Canonical app origin for the throttle response URL. Deliberately NOT
 * derived from x-forwarded-* headers (client-influenceable on platforms
 * that do not overwrite them): the configured NEXTAUTH_URL first, then the
 * request's own absolute URL. The current caller only parses the `error`
 * param, but keeping the value canonical also makes any future
 * redirect:true caller safe.
 */
function appOrigin(request: Request): string {
  const env = process.env.NEXTAUTH_URL;
  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      // fall through to the request origin
    }
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3000";
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
      // next-auth itself returns for a failed credentials callback, and
      // point it at the APP's login page (not next-auth's built-in one).
      return NextResponse.json(
        {
          url: `${appOrigin(request)}/login?error=TooManyAttempts`,
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
