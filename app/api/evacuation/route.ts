import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  serverError,
  success,
} from "@/lib/api/utils";
import Evacuation from "@/lib/db/models/Evacuation";
import AuditLog from "@/lib/db/models/AuditLog";
import { can } from "@/lib/auth/rbac";
import { strings } from "@/lib/i18n/strings";
import {
  buildRoster,
  countsFor,
  lightSession,
  evacuationResponse,
} from "@/lib/evacuation";

/**
 * GET  /api/evacuation            → light session
 *      ?roster=1                   → + scoped floor locations and (when the
 *                                     caller's role allows) names — the
 *                                     full-screen evacuation display's key
 *      ?closed=1                   → + summary of the last closed session
 * POST /api/evacuation             → start (evacuation:start)
 * PATCH /api/evacuation            → close the active session (evacuation:close)
 */

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  await connectDB();

  const url = new URL(request.url);

  try {
    return success(
      await evacuationResponse(user, {
        roster: url.searchParams.get("roster") === "1",
        closed: url.searchParams.get("closed") === "1",
      })
    );
  } catch (error) {
    console.error("Error reading evacuation session:", error);
    return serverError();
  }
}

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "evacuation:start")) return forbidden();

  await connectDB();

  try {
    const roster = await buildRoster();
    const session = await Evacuation.create({
      startedBy: user.id,
      startedByName: user.name,
      startedAt: new Date(),
      roster,
    });

    await AuditLog.create({
      actorUserId: user.id,
      action: "evacuation_start",
      targetId: session._id,
      metadata: countsFor(session.roster),
    });

    return success({ session: lightSession(session, user.id) }, 201);
  } catch (error) {
    // Two wardens pressing "start" at once → the partial unique index on
    // { status: "active" } makes exactly one of them the winner
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: strings.evacAlreadyActive },
        { status: 409 }
      );
    }
    console.error("Error starting evacuation:", error);
    return serverError();
  }
}

export async function PATCH() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "evacuation:close")) return forbidden();

  await connectDB();

  try {
    const session = await Evacuation.findOne({ status: "active" });
    if (!session) {
      return NextResponse.json(
        { error: strings.evacNoSession },
        { status: 409 }
      );
    }

    session.status = "closed";
    session.closedAt = new Date();
    await session.save();

    const counts = countsFor(session.roster);
    await AuditLog.create({
      actorUserId: user.id,
      action: "evacuation_close",
      targetId: session._id,
      metadata: counts,
    });

    return success({ closedAt: session.closedAt.toISOString(), counts });
  } catch (error) {
    console.error("Error closing evacuation:", error);
    return serverError();
  }
}
