import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { badRequest, serverError, success, secureCompare } from "@/lib/api/utils";
import { strings } from "@/lib/i18n/strings";
import Attendance from "@/lib/db/models/Attendance";
import Floor from "@/lib/db/models/Floor";
import { visitorCheckInSchema } from "@/lib/validation/schemas";
import { checkRateLimit, clientIp } from "@/lib/security/rateLimit";

const MAX_ATTEMPTS = 60;
const WINDOW_MS = 60 * 1000;

export async function POST(request: Request) {
  // Public endpoint → throttle per IP before touching the database
  const rate = checkRateLimit(
    `visitor:${clientIp(request)}`,
    MAX_ATTEMPTS,
    WINDOW_MS
  );
  if (!rate.ok) {
    return NextResponse.json(
      { error: strings.tooManyAttempts },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  await connectDB();

  try {
    const body = await request.json();
    const validation = visitorCheckInSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.errors[0].message);
    }

    const { visitorName, visitorPhone, floorId, token } = validation.data;

    // Validate floor exists
    const floor = await Floor.findById(floorId);
    if (!floor) {
      return badRequest("Lantai tidak dijumpai");
    }

    // The visitor check-in page is public, so the scanned QR token is the
    // only capability check: the caller must present the current token for
    // THIS floor. Otherwise anyone can fake presence on any floor.
    if (!secureCompare(token, floor.qrToken)) {
      return NextResponse.json({ error: strings.qrInvalid }, { status: 403 });
    }

    // Create visitor attendance record
    const attendance = await Attendance.create({
      type: "visitor",
      visitorName,
      floorId: floor._id,
      checkedInAt: new Date(),
      method: "qr",
    });

    return success(
      {
        message: `Berjaya daftar masuk sebagai pelawat di ${floor.name}`,
        attendance: {
          _id: attendance._id,
          floorName: floor.name,
          checkedInAt: attendance.checkedInAt,
        },
      },
      201
    );
  } catch (error) {
    console.error("Error checking in visitor:", error);
    return serverError();
  }
}