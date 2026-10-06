import { NextResponse } from "next/server";
import { handlers } from "@/lib/auth/config";
import { checkRateLimit, clientIp } from "@/lib/security/rateLimit";
import { strings } from "@/lib/i18n/strings";

type AuthRequest = Parameters<typeof handlers.POST>[0];

const SIGNIN_WINDOW_MS = 60 * 1000;
const SIGNIN_MAX_PER_MINUTE = 15;

export const GET = handlers.GET;

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
      return NextResponse.json(
        { error: strings.tooManyAttempts },
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
