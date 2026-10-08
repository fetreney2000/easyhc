import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { badRequest, serverError, success } from "@/lib/api/utils";
import { strings } from "@/lib/i18n/strings";
import Attendance from "@/lib/db/models/Attendance";
import { visitorCheckOutSchema } from "@/lib/validation/schemas";
import { checkRateLimit, clientIp } from "@/lib/security/rateLimit";
import { verifyVisitorToken } from "@/lib/security/visitorToken";

const MAX_ATTEMPTS = 60;
const WINDOW_MS = 60 * 1000;

/**
 * Public visitor check-out (the visitor's own session, no account).
 *
 * POST /api/visitor/checkout
 * Body: { attendanceId, checkoutToken }
 *
 * Unauthenticated by design, so the `checkoutToken` is an HMAC scoped to this
 * one record, issued when they checked in (lib/security/visitorToken.ts).
 * The floor's printed qrToken is deliberately NOT accepted here: it is public,
 * and anyone holding it could otherwise close somebody else's record.
 * Only visitor records can be closed through this endpoint; employee records
 * require an authenticated session and ownership/scope checks on
 * /api/attendance/checkout.
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

    const { attendanceId, checkoutToken } = validation.data;

    const record = await Attendance.findById(attendanceId);
    if (!record) return badRequest(strings.recordNotFound);
    if (record.checkedOutAt) return badRequest(strings.alreadyCheckedOut);

    // This endpoint only ever closes visitor records
    if (record.type !== "visitor") {
      return NextResponse.json({ error: strings.unauthorized }, { status: 403 });
    }

    // Capability check: only the token issued for THIS record works
    const valid = verifyVisitorToken(checkoutToken, {
      id: record._id.toString(),
      floorId: record.floorId.toString(),
      checkedInAt: record.checkedInAt,
    });
    if (!valid) {
      return NextResponse.json(
        { error: strings.invalidCheckoutToken },
        { status: 403 }
      );
    }

    record.checkedOutAt = new Date();
    record.checkedOutBy = "self";
    await record.save();

    return success({ message: strings.checkOutSuccess });
  } catch (error) {
    console.error("Error checking out visitor:", error);
    return serverError();
  }
}
