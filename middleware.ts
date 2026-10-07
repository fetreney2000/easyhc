import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Muster mode was replaced by evacuation mode (product decision). Redirect at
 * the EDGE, before the dynamic layout renders: that yields a real HTTP 308
 * the browser (and fetch) follows, instead of the HTML meta-refresh fallback
 * Next emits when a redirect is thrown mid-stream.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/muster") {
    return NextResponse.redirect(new URL("/evacuation", request.url), 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/muster"],
};
