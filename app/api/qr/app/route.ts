import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { strings } from "@/lib/i18n/strings";

// Derived from the ORIGIN THE REQUEST ARRIVED ON — must never be baked at
// build time (that would freeze a build-host URL into every printed QR)
export const dynamic = "force-dynamic";

/**
 * GET /api/qr/app — the STAFF ACCESS QR: one static code for notice boards
 * that opens the app itself (root URL → logged-in staff land on the
 * dashboard, newcomers on the login page).
 *
 * Unlike the floor QRs this encodes no capability — it is the address of
 * the public login page, so it needs no auth (an <img> on the admin QR page
 * loads it like any picture) and stays safe to print anywhere.
 *
 * The URL comes from the ORIGIN THE REQUEST ARRIVED ON (what the admin is
 * browsing is what gets printed — display text and QR can never disagree),
 * with NEXTAUTH_URL as the non-browser fallback. Visual style matches the
 * floor QRs so printed material looks consistent.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const appUrl = `${url.protocol}//${url.host}`;

    const pngDataUrl = await QRCode.toDataURL(appUrl, {
      type: "image/png",
      width: 400,
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#FFFFFF" },
      scale: 4,
    });

    const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, "");
    const pngBuffer = Buffer.from(base64Data, "base64");

    return new NextResponse(pngBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
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
