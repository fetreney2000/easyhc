import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { badRequest, serverError, success, secureCompare } from "@/lib/api/utils";
import { strings } from "@/lib/i18n/strings";
import Attendance from "@/lib/db/models/Attendance";
import Floor from "@/lib/db/models/Floor";
import { visitorCheckInSchema } from "@/lib/validation/schemas";
import { checkRateLimit, clientIp } from "@/lib/security/rateLimit";
import { issueVisitorToken } from "@/lib/security/visitorToken";
import { IAttendance } from "@/lib/db/types";

const MAX_ATTEMPTS = 60;
const WINDOW_MS = 60 * 1000;

/**
 * The 409 body for "this phone is already checked in somewhere".
 *
 * Deliberately NO checkoutToken: this caller only proved they know a phone
 * number, not that they are that person — minting a token would let anyone
 * who knows a colleague's number sign them out mid-muster. Check-out stays
 * scoped to the device that checked in, or to an admin force-checkout.
 */
async function alreadyCheckedInResponse(
  existing: Pick<IAttendance, "_id" | "floorId" | "checkedInAt">,
  requestedFloor: { _id: IAttendance["floorId"]; name: string }
) {
  const sameFloor =
    existing.floorId.toString() === requestedFloor._id.toString();
  const floor = sameFloor
    ? requestedFloor
    : await Floor.findById(existing.floorId).select("name").lean();
  const floorName = floor?.name ?? "";

  return NextResponse.json(
    {
      error: !floorName
        ? strings.visitorAlreadyCheckedIn
        : sameFloor
          ? strings.visitorAlreadyOnThisFloor
          : strings.visitorAlreadyOnFloor(floorName),
      alreadyCheckedIn: true,
      attendance: {
        _id: existing._id,
        floorId: existing.floorId,
        floorName,
        checkedInAt: existing.checkedInAt,
      },
    },
    { status: 409 }
  );
}

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

    // visitorPhone arrives already normalised by the schema
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

    // One open check-in per phone, building-wide: a visitor cannot be
    // "present" twice without checking out first (they may only be in one
    // place during a muster). Returns the existing record so the client can
    // offer a check-out instead of just failing.
    const existing = await Attendance.findOne({
      type: "visitor",
      visitorPhone,
      checkedOutAt: null,
    })
      .sort({ checkedInAt: -1 })
      .lean();

    if (existing) {
      return alreadyCheckedInResponse(existing, {
        _id: floor._id,
        name: floor.name,
      });
    }

    // Create the visitor record. The partial unique index on
    // {type, visitorPhone} over OPEN records (lib/db/models/Attendance.ts) is
    // the atomic backstop: if both sides of a race got past the pre-check
    // above, exactly one insert wins and the loser reports 409 — not a 500.
    let attendance: IAttendance;
    try {
      attendance = await Attendance.create({
        type: "visitor",
        visitorName,
        visitorPhone,
        floorId: floor._id,
        checkedInAt: new Date(),
        method: "qr",
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const winner = await Attendance.findOne({
          type: "visitor",
          visitorPhone,
          checkedOutAt: null,
        })
          .sort({ checkedInAt: -1 })
          .lean();

        if (winner) {
          return alreadyCheckedInResponse(winner, {
            _id: floor._id,
            name: floor.name,
          });
        }
      }
      throw error;
    }

    const checkoutToken = issueVisitorToken({
      id: attendance._id.toString(),
      floorId: floor._id.toString(),
      checkedInAt: attendance.checkedInAt,
    });

    return success(
      {
        message: `Berjaya daftar masuk sebagai pelawat di ${floor.name}`,
        attendance: {
          _id: attendance._id,
          floorName: floor.name,
          checkedInAt: attendance.checkedInAt,
        },
        checkoutToken,
      },
      201
    );
  } catch (error) {
    console.error("Error checking in visitor:", error);
    return serverError();
  }
}
