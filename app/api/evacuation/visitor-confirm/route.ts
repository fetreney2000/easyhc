import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { badRequest, forbidden, serverError, success } from "@/lib/api/utils";
import Evacuation from "@/lib/db/models/Evacuation";
import Attendance from "@/lib/db/models/Attendance";
import { verifyVisitorToken } from "@/lib/security/visitorToken";
import { checkRateLimit, clientIp } from "@/lib/security/rateLimit";
import { normalizeVisitorPhone } from "@/lib/validation/schemas";
import { strings } from "@/lib/i18n/strings";

const MAX_ATTEMPTS = 60;
const WINDOW_MS = 60 * 1000;

/**
 * POST /api/evacuation/visitor-confirm — PUBLIC (visitors have no account).
 *
 * A visitor at the assembly point confirms "saya selamat" either with the
 * check-out token their own device holds (strongest proof: the HMAC from
 * their check-in) or with their phone number (new device / cleared storage —
 * same identity the whole visitor flow already uses), rate-limited per IP.
 *
 * The response is deliberately minimal — `{ confirmedAt, floorName }` only.
 * Per spec, visitors get NO statistics: no counts, no roster, no names of
 * anybody else (asserted in scripts/api-check.ts).
 */
export async function POST(request: Request) {
  const rate = checkRateLimit(
    `evac-visitor:${clientIp(request)}`,
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
    const session = await Evacuation.findOne({ status: "active" });
    if (!session) {
      return NextResponse.json(
        { error: strings.evacNoSession },
        { status: 409 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      phone?: unknown;
      attendanceId?: unknown;
      token?: unknown;
    } | null;
    if (!body) return badRequest(strings.evacInvalidPayload);

    let record;
    if (typeof body.attendanceId === "string" && typeof body.token === "string") {
      // Device path: prove possession of the per-attendance check-out token
      if (!Types.ObjectId.isValid(body.attendanceId)) {
        return badRequest(strings.evacInvalidPayload);
      }
      record = await Attendance.findOne({
        _id: body.attendanceId,
        type: "visitor",
      });
      if (
        !record ||
        !verifyVisitorToken(body.token, {
          id: record._id.toString(),
          floorId: record.floorId.toString(),
          checkedInAt: record.checkedInAt,
        })
      ) {
        return forbidden();
      }
    } else if (typeof body.phone === "string") {
      const phone = normalizeVisitorPhone(body.phone);
      if (phone.length < 7) return badRequest(strings.invalidPhone);
      // Phone path: same identity as check-in — the currently open record
      record = await Attendance.findOne({
        type: "visitor",
        visitorPhone: phone,
        checkedOutAt: null,
      });
      if (!record) {
        return NextResponse.json(
          { error: strings.evacVisitorNoMatch },
          { status: 404 }
        );
      }
    } else {
      return badRequest(strings.evacInvalidPayload);
    }

    // Only people on the roster SNAPSHOT can be confirmed; whoever checked in
    // after the alarm is not expected, and staff resolve that in person.
    // NOT-found and NOT-on-roster return the IDENTICAL neutral 404: two
    // distinguishable responses would turn this public endpoint into a
    // per-phone presence oracle during an evacuation.
    const entry = session.roster.find(
      (item) =>
        item.visitorAttendanceId?.toString() === record._id.toString()
    );
    if (!entry) {
      return NextResponse.json(
        { error: strings.evacVisitorNoMatch },
        { status: 404 }
      );
    }

    if (!entry.confirmedAt) {
      const confirmedAt = new Date();
      // No _id in the filter: targets THE active session's entry, so a
      // session swap between our read and our write cannot misfire
      const result = await Evacuation.updateOne(
        {
          status: "active",
          roster: {
            $elemMatch: {
              visitorAttendanceId: record._id,
              confirmedAt: null,
            },
          },
        },
        { $set: { "roster.$.confirmedAt": confirmedAt } }
      );

      if (result.matchedCount === 0) {
        // Session closed or someone confirmed it between read and write —
        // reconcile with the database; never report a write that didn't happen
        const fresh = await Evacuation.findOne({ status: "active" });
        if (!fresh) {
          return NextResponse.json(
            { error: strings.evacNoSession },
            { status: 409 }
          );
        }
        const freshEntry = fresh.roster.find(
          (item) =>
            item.visitorAttendanceId?.toString() === record._id.toString()
        );
        if (!freshEntry?.confirmedAt) {
          return NextResponse.json(
            { error: strings.evacVisitorNoMatch },
            { status: 404 }
          );
        }
        entry.confirmedAt = freshEntry.confirmedAt;
      } else {
        entry.confirmedAt = confirmedAt;
      }
    }

    // No stats: floor context only (their own), as per the product spec
    return success({
      confirmedAt: entry.confirmedAt.toISOString(),
      floorName: entry.floorName ?? strings.unknownFloor,
    });
  } catch (error) {
    console.error("Error confirming visitor evacuation:", error);
    return serverError();
  }
}
