import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { connectDB } from "@/lib/db/mongoose";
import Floor from "@/lib/db/models/Floor";

/**
 * Generate QR code image for a floor.
 * Returns a PNG image.
 * GET /api/qr/[floorId]?format=png|svg
 */
export async function GET(
  request: Request,
  { params }: { params: { floorId: string } }
) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "png";

  try {
    const floor = await Floor.findById(params.floorId).lean();
    if (!floor) {
      return NextResponse.json(
        { error: "Lantai tidak dijumpai" },
        { status: 404 }
      );
    }

    // The QR code encodes a URL that can be used for both employee check-in and visitor check-in
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const qrUrl = `${baseUrl}/visitor/${floor._id}?token=${floor.qrToken}`;

    if (format === "svg") {
      const svg = await QRCode.toString(qrUrl, {
        type: "svg",
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // Default: PNG
    const pngDataUrl = await QRCode.toDataURL(qrUrl, {
      type: "image/png",
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Convert data URL to buffer
    const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, "");
    const pngBuffer = Buffer.from(base64Data, "base64");

    return new NextResponse(pngBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Error generating QR:", error);
    return NextResponse.json(
      { error: "Ralat menjana kod QR" },
      { status: 500 }
    );
  }
}