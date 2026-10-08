import { NextResponse } from "next/server";
import { strings } from "@/lib/i18n/strings";
import QRCode from "qrcode";
import { connectDB } from "@/lib/db/mongoose";
import { getAuthenticatedUser } from "@/lib/api/utils";
import { can } from "@/lib/auth/rbac";
import { encryptQrPayload } from "@/lib/qr/token";
import Floor from "@/lib/db/models/Floor";

/**
 * Generate QR code image for a floor.
 * GET /api/qr/[floorId]?type=employee|visitor&format=png|svg
 *
 * Requires an authenticated user with floors:manage — the QR image IS the
 * capability to check in to the floor, so it must not be world-readable.
 *
 * - type=employee (default): encrypted rotating qrToken (for in-app scanner)
 * - type=visitor: URL to visitor check-in page (carries ?token=<qrToken>)
 */
export async function GET(
  request: Request,
  { params }: { params: { floorId: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(user.role, "floors:manage")) {
    return NextResponse.json({ error: strings.forbidden }, { status: 403 });
  }

  await connectDB();

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "png";
  const type = searchParams.get("type") || "employee";

  try {
    const floor = await Floor.findById(params.floorId).lean();
    if (!floor) {
      return NextResponse.json(
        { error: strings.floorNotFound },
        { status: 404 }
      );
    }

    let qrContent: string;

    if (type === "visitor") {
      // Visitor QR: full URL to visitor check-in page
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      qrContent = `${baseUrl}/visitor/${floor._id}?token=${floor.qrToken}`;
    } else {
      // Employee QR: encrypted rotating token (for in-app scanning)
      qrContent = encryptQrPayload(floor.qrToken);
    }

    if (format === "svg") {
    const svg = await QRCode.toString(qrContent, {
        type: "svg",
        width: 400,
        margin: 3,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          // private: the QR is an access capability, shared caches must not store it
          "Cache-Control": "private, max-age=86400",
        },
      });
    }

    // Default: PNG
    const pngDataUrl = await QRCode.toDataURL(qrContent, {
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
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Error generating QR:", error);
    return NextResponse.json(
      { error: strings.qrGenerateError },
      { status: 500 }
    );
  }
}