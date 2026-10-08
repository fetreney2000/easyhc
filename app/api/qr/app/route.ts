import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { strings } from "@/lib/i18n/strings";

// Derived from the request's own origin — must never be baked at build time
// (that would freeze a build-host URL into every printed QR)
export const dynamic = "force-dynamic";

/** First value of a possibly comma-list header, or null. */
function headerValue(request: Request, name: string): string | null {
  const value = request.headers.get(name)?.split(",")[0]?.trim();
  return value || null;
}

/** Absolute origin of a URL, or null when it is relative/malformed. */
function safeOrigin(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * GET /api/qr/app — the STAFF ACCESS QR: one static code for notice boards
 * that opens the app itself (root URL → logged-in staff land on the
 * dashboard, newcomers on the login page).
 *
 * Unlike the floor QRs this encodes no capability — it is the address of
 * the public login page, so it needs no auth (an <img> on the admin QR page
 * loads it like any picture) and stays safe to print anywhere.
 *
 * The URL is assembled from the request's ORIGIN (what the admin is browsing
 * is what gets printed — display text and QR can never disagree), preferring
 * forwarded headers (production proxies), then an absolute request.url, then
 * NEXTAUTH_URL. `request.url` alone is NOT trusted: behind some runtimes it
 * arrives relative, and parsing that used to throw — which surfaced in
 * production as the generic "Ralat menjana kod QR".
 *
 * Visual style matches the floor QRs so printed material looks consistent.
 */
export async function GET(request: Request) {
  const forwardedHost = headerValue(request, "x-forwarded-host");
  const host = forwardedHost ?? headerValue(request, "host");
  const forwardedProto = headerValue(request, "x-forwarded-proto");
  const requestOrigin = safeOrigin(request.url);
  const envOrigin = process.env.NEXTAUTH_URL
    ? safeOrigin(process.env.NEXTAUTH_URL)
    : null;

  const appUrl =
    // Production proxies: nearest hop's proto + the canonical host
    (forwardedProto && host ? `${forwardedProto}://${host}` : null) ??
    // Direct request with an absolute URL
    requestOrigin ??
    // Configured canonical URL
    envOrigin ??
    // Host known but protocol not — http is fine, every real deployment
    // redirects it to https
    (host ? `http://${host}` : null) ??
    "http://localhost:3000";

  try {
    const options = {
      width: 400,
      margin: 3,
      errorCorrectionLevel: "M" as const,
      color: { dark: "#000000", light: "#FFFFFF" },
    };

    let body: BodyInit;
    let contentType: string;

    try {
      const pngDataUrl = await QRCode.toDataURL(appUrl, {
        ...options,
        type: "image/png",
        scale: 4,
      });
      const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, "");
      body = Buffer.from(base64Data, "base64") as unknown as BodyInit;
      contentType = "image/png";
    } catch (pngError) {
      // The PNG renderer has the larger dependency surface — the SVG
      // renderer is pure string output. A poster must never end up blank
      // because one encoder failed in this runtime.
      console.error("PNG QR render failed, falling back to SVG:", pngError);
      body = await QRCode.toString(appUrl, { ...options, type: "svg" });
      contentType = "image/svg+xml";
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "X-Qr-Url": appUrl,
      },
    });
  } catch (error) {
    console.error("Error generating app QR:", error);
    return NextResponse.json(
      { error: strings.qrGenerateError },
      { status: 500 }
    );
  }
}
