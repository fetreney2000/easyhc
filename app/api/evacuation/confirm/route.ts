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
import { unitMembership } from "@/lib/auth/scope";
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

  await connectDB();

  try {
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
    await Evacuation.updateOne(
      {
        _id: session._id,
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

    return success({ confirmedAt: confirmedAt.toISOString() });
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

  await connectDB();

  try {
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
      const membership = await unitMembership(user.unitId);
      const homeFloorIds =
        membership?.homeFloorIds.map((floor) => floor.toString()) ?? [];
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

    if (result.modifiedCount > 0) {
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
    }

    const fresh = await Evacuation.findById(session._id);
    return success({ counts: countsFor(fresh?.roster ?? []) });
  } catch (error) {
    console.error("Error confirming roster entry:", error);
    return serverError();
  }
}
