import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  serverError,
  success,
} from "@/lib/api/utils";
import Evacuation from "@/lib/db/models/Evacuation";
import { can } from "@/lib/auth/rbac";
import { displayPayload } from "@/lib/evacuation";
import { strings } from "@/lib/i18n/strings";

/**
 * GET /api/evacuation/[id] — one session as an after-action report.
 *
 * Gated by evacuation:view_report (the same four roles that activate
 * evacuation mode). The payload reuses displayPayload(), so name/floor
 * visibility follows the exact rules of the live view: safety/admin see the
 * whole roster, a floor head sees their own floor, and counts are the
 * building-wide facts of that incident.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "evacuation:view_report")) return forbidden();

  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json(
      { error: strings.evacSessionNotFound },
      { status: 404 }
    );
  }

  try {
    await connectDB();
    const session = await Evacuation.findById(params.id);
    if (!session) {
      return NextResponse.json(
        { error: strings.evacSessionNotFound },
        { status: 404 }
      );
    }
    const response = success({ session: await displayPayload(session, user) });
    // Roster names in this payload: never let a proxy cache one user's view
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Error reading evacuation report:", error);
    return serverError();
  }
}
