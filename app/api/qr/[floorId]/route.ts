import { NextResponse } from "next/server";
import QRCode from "qrcode";
import crypto from "crypto";
import { connectDB } from "@/lib/db/mongoose";
import Floor from "@/lib/db/models/Floor";

// Simple encryption for floor ID (employee QR)
const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || "default-key";
function encryptFloorId(floorId: string): string {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)),
    Buffer.from(ENCRYPTION_KEY.padEnd(16, "0").slice(0, 16))
  );
  let encrypted = cipher.update(floorId, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

/**
 * Generate QR code image for a floor.
 * GET /api/qr/[floorId]?type=employee|visitor&format=png|svg
 *
 * - type=employee (default): Encrypted floor ID only (for in-app scanner)
 * - type=visitor: URL to visitor check-in page
 */
export async function GET(
  request: Request,
  { params }: { params: { floorId: string } }
) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "png";
  const type = searchParams.get("type") || "employee";

  try {
    const floor = await Floor.findById(params.floorId).lean();
    if (!floor) {
      return NextResponse.json(
        { error: "Lantai tidak dijumpai" },
        { status: 404 }
      );
    }

    let qrContent: string;

    if (type === "visitor") {
      // Visitor QR: full URL to visitor check-in page
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      qrContent = `${baseUrl}/visitor/${floor._id}?token=${floor.qrToken}`;
    } else {
      // Employee QR: encrypted floor ID only (for in-app scanning)
      qrContent = encryptFloorId(floor._id.toString());
    }

    if (format === "svg") {
      const svg = await QRCode.toString(qrContent, {
        type: "svg",
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // Default: PNG
    const pngDataUrl = await QRCode.toDataURL(qrContent, {
      type: "image/png",
      width: 300,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

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