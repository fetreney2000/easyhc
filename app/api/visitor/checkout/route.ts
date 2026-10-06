import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import {
  badRequest,
  serverError,
  success,
  secureCompare,
} from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";
import Floor from "@/lib/db/models/Floor";
import { visitorCheckOutSchema } from "@/lib/validation/schemas";
import { strings } from "@/lib/i18n/strings";
import { checkRateLimit, clientIp } from "@/lib/security/rateLimit";

const MAX_ATTEMPTS = 60;
const WINDOW_MS = 60 * 1000;

/**
 * Public visitor check-out (the visitor's own session, via the printed QR).
 *
 * POST /api/visitor/checkout
 * Body: { attendanceId, token }
 *
 * Unauthenticated by design (visitors have no account), so:
 *  - `token` must match the qrToken of the floor the record belongs to, and
 *  - only visitor records can be closed here — employee records require an
 *    authenticated session and ownership/scope checks on
 *    /api/attendance/checkout.
 */
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
    const validation = visitorCheckOutSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.errors[0].message);
    }

    const { attendanceId, token } = validation.data;

    const record = await Attendance.findById(attendanceId);
    if (!record) return badRequest("Rekod tidak dijumpai");
    if (record.checkedOutAt) return badRequest("Sudah didaftar keluar");

    // This endpoint only ever closes visitor records
    if (record.type !== "visitor") {
      return NextResponse.json({ error: strings.unauthorized }, { status: 403 });
    }

    // Capability check: the token must belong to the record's floor
    const floor = await Floor.findById(record.floorId);
    if (!floor || !secureCompare(token, floor.qrToken)) {
      return NextResponse.json({ error: strings.qrInvalid }, { status: 403 });
    }

    record.checkedOutAt = new Date();
    record.checkedOutBy = "self";
    await record.save();

    return success({ message: "Berjaya daftar keluar" });
  } catch (error) {
    console.error("Error checking out visitor:", error);
    return serverError();
  }
}
