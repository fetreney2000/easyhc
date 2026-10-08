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
 *                                    Response is the FLAT { closedAt, counts }
 *                                    (not a { lastClosed } envelope like GET):
 *                                    the only in-tree consumer reads exactly
 *                                    this shape — intentional asymmetry.
 */

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);

  try {
    await connectDB();
    const response = success(
      await evacuationResponse(user, {
        roster: url.searchParams.get("roster") === "1",
        closed: url.searchParams.get("closed") === "1",
        history: url.searchParams.get("history") === "1",
      })
    );
    // Roster names in this payload: never let a proxy cache one user's view
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Error reading evacuation session:", error);
    return serverError();
  }
}

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "evacuation:start")) return forbidden();

  try {
    await connectDB();
    // Fail loudly BEFORE creating anything if the one-active-session index
    // cannot be built (restored dump, autoIndex off) — otherwise the 409
    // path below would never fire and two sessions could coexist
    await Evacuation.init();

    const roster = await buildRoster();
    const session = await Evacuation.create({
      startedBy: user.id,
      startedByName: user.name,
      startedAt: new Date(),
      roster,
    });

    try {
      await AuditLog.create({
        actorUserId: user.id,
        action: "evacuation_start",
        targetId: session._id,
        metadata: countsFor(session.roster),
      });
    } catch (auditError) {
      // The session started — an audit failure must not turn that into a 500
      // the client would retry into a confusing 409
      console.error("Audit write failed (evacuation_start):", auditError);
    }

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

  try {
    await connectDB();
    // Atomic precondition: only THE active session can close, so a double
    // tap yields one 200 and one 409 (one audit row, one closedAt), and the
    // counts come from the document as it was when it actually closed
    const session = await Evacuation.findOneAndUpdate(
      { status: "active" },
      { $set: { status: "closed", closedAt: new Date() } },
      { new: true }
    );
    if (!session) {
      return NextResponse.json(
        { error: strings.evacNoSession },
        { status: 409 }
      );
    }

    const counts = countsFor(session.roster);
    try {
      await AuditLog.create({
        actorUserId: user.id,
        action: "evacuation_close",
        targetId: session._id,
        metadata: counts,
      });
    } catch (auditError) {
      // The close DID happen — an audit failure must not turn it into a 500
      // that the client would retry into a confusing 409
      console.error("Audit write failed (evacuation_close):", auditError);
    }

    return success({ closedAt: session.closedAt?.toISOString(), counts });
  } catch (error) {
    console.error("Error closing evacuation:", error);
    return serverError();
  }
}
