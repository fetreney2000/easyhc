import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Muster mode was replaced by evacuation mode (product decision). Redirect at
 * the EDGE, before the dynamic layout renders: that yields a real HTTP 308
 * the browser (and fetch) follows, instead of the HTML meta-refresh fallback
 * Next emits when a redirect is thrown mid-stream.
 *
 * The query string is preserved (a 308 is expected to keep it), the
 * `/muster/` trailing-slash form is covered by the matcher, and subpaths
 * would 308 too rather than 404.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/muster" || pathname.startsWith("/muster/")) {
    return NextResponse.redirect(
      new URL(`/evacuation${search}`, request.url),
      308
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/muster", "/muster/:path*"],
};
