import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  success,
} from "@/lib/api/utils";
import Evacuation from "@/lib/db/models/Evacuation";
import AuditLog from "@/lib/db/models/AuditLog";
import { can, getEvacuationScope } from "@/lib/auth/rbac";
import { unitHomeFloorIds } from "@/lib/auth/scope";
import { strings } from "@/lib/i18n/strings";
import { countsFor } from "@/lib/evacuation";

/**
 * POST  /api/evacuation/confirm            → "saya selamat" (self, idempotent)
 * PATCH /api/evacuation/confirm            → warden confirms/unconfirms ANOTHER
 *                                             roster entry (evacuation:confirm_others)
 *
 * Both writes are ATOMIC positional updates: many people tap "Saya Selamat"
 * within the same seconds at the muster point, and a whole-document save
 * would silently drop all but the last confirmation.
 */

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "evacuation:confirm_own")) return forbidden();

  try {
    await connectDB();
    const session = await Evacuation.findOne({ status: "active" });
    if (!session) {
      return NextResponse.json({ error: strings.evacNoSession }, { status: 409 });
    }

    const entry = session.roster.find(
      (item) => item.userId?.toString() === user.id
    );
    if (!entry) {
      // Account created after the alarm went off — not on the snapshot
      return NextResponse.json(
        { error: strings.evacNotInRoster },
        { status: 409 }
      );
    }

    if (entry.confirmedAt) {
      // Already confirmed: idempotent success, no second write
      return success({ confirmedAt: entry.confirmedAt.toISOString() });
    }

    const confirmedAt = new Date();
    // No _id in the filter: this targets whoever THE active session is right
    // now, so a session swap between our read and our write cannot misfire.
    const result = await Evacuation.updateOne(
      {
        status: "active",
        roster: { $elemMatch: { userId: user.id, confirmedAt: null } },
      },
      {
        $set: {
          "roster.$.confirmedAt": confirmedAt,
          "roster.$.confirmedBy": user.id,
        },
      }
    );

    if (result.matchedCount === 1) {
      return success({ confirmedAt: confirmedAt.toISOString() });
    }

    // Matched nothing: the session closed, a warden confirmed this entry, or
    // a new session replaced the one we read. Re-read and report the TRUTH —
    // never a timestamp that isn't in the database (a dropped confirmation
    // must never look saved).
    const fresh = await Evacuation.findOne({ status: "active" });
    const freshEntry = fresh?.roster.find(
      (item) => item.userId?.toString() === user.id
    );
    if (freshEntry?.confirmedAt) {
      return success({ confirmedAt: freshEntry.confirmedAt.toISOString() });
    }
    return NextResponse.json(
      { error: fresh ? strings.evacNotInRoster : strings.evacNoSession },
      { status: 409 }
    );
  } catch (error) {
    console.error("Error confirming evacuation:", error);
    return serverError();
  }
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "evacuation:confirm_others")) return forbidden();

  const body = (await request.json().catch(() => null)) as {
    rosterId?: unknown;
    confirm?: unknown;
  } | null;
  if (
    !body ||
    typeof body.rosterId !== "string" ||
    !Types.ObjectId.isValid(body.rosterId) ||
    typeof body.confirm !== "boolean"
  ) {
    return badRequest(strings.evacInvalidPayload);
  }

  try {
    await connectDB();
    const session = await Evacuation.findOne({ status: "active" });
    if (!session) {
      return NextResponse.json({ error: strings.evacNoSession }, { status: 409 });
    }

    const entry = session.roster.find(
      (item) => item._id.toString() === body.rosterId
    );
    if (!entry) {
      return NextResponse.json(
        { error: strings.evacEntryNotFound },
        { status: 404 }
      );
    }

    // Holding evacuation:confirm_others is not enough by itself — a floor
    // warden may only touch entries on their own home floor (mirrors
    // canForceCheckoutRecord for check-outs)
    const scope = getEvacuationScope(user.role);
    if (scope === "none") return forbidden();
    if (scope === "own_floor") {
      const homeFloorIds = (await unitHomeFloorIds(user.unitId)).map(
        (floor) => floor.toString()
      );
      const floorId = entry.floorId?.toString();
      if (!floorId || !homeFloorIds.includes(floorId)) return forbidden();
    }

    const result = body.confirm
      ? await Evacuation.updateOne(
          {
            _id: session._id,
            status: "active",
            roster: { $elemMatch: { _id: entry._id, confirmedAt: null } },
          },
          {
            $set: {
              "roster.$.confirmedAt": new Date(),
              "roster.$.confirmedBy": user.id,
            },
          }
        )
      : await Evacuation.updateOne(
          { _id: session._id, status: "active", "roster._id": entry._id },
          {
            $unset: {
              "roster.$.confirmedAt": "",
              "roster.$.confirmedBy": "",
            },
          }
        );

    if (result.matchedCount === 0) {
      // The session closed between read and write — never answer 200 for a
      // discarded action. If the entry is already in the requested state
      // (someone else did it first), that is an idempotent success.
      const freshActive = await Evacuation.findOne({ status: "active" });
      const freshEntry = freshActive?.roster.find(
        (item) => item._id.toString() === body.rosterId
      );
      const alreadyInRequestedState =
        !!freshEntry && Boolean(freshEntry.confirmedAt) === body.confirm;
      if (!alreadyInRequestedState) {
        return NextResponse.json(
          {
            error: freshActive
              ? strings.evacEntryNotFound
              : strings.evacNoSession,
          },
          { status: 409 }
        );
      }
      // Already there → idempotent 200; no audit (we changed nothing)
    } else if (result.modifiedCount > 0) {
      try {
        await AuditLog.create({
          actorUserId: user.id,
          action: "evacuation_confirm_other",
          targetId: session._id,
          metadata: {
            rosterId: body.rosterId,
            name: entry.name,
            type: entry.type,
            floorId: entry.floorId?.toString(),
            confirm: body.confirm,
          },
        });
      } catch (auditError) {
        // The confirmation DID happen — an audit failure must not turn it
        // into a 500 the client would retry
        console.error(
          "Audit write failed (evacuation_confirm_other):",
          auditError
        );
      }
    }

    const fresh = await Evacuation.findById(session._id);
    return success({ counts: countsFor(fresh?.roster ?? []) });
  } catch (error) {
    console.error("Error confirming roster entry:", error);
    return serverError();
  }
}
