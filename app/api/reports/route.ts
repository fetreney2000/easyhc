import { NextResponse } from "next/server";
import type { FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  success,
} from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";
import { IAttendance } from "@/lib/db/types";
import { can, getReportsScope } from "@/lib/auth/rbac";
import { scopeFilter } from "@/lib/auth/scope";
import { strings } from "@/lib/i18n/strings";

/** Row cap — returned to the UI so truncation is never silent. */
const REPORT_PAGE_SIZE = 1000;

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const hasReportPermission =
    can(user.role, "reports:generate_all") ||
    can(user.role, "reports:generate_own_floor") ||
    can(user.role, "reports:generate_own_unit") ||
    can(user.role, "reports:generate_department");

  if (!hasReportPermission) return forbidden();

  await connectDB();

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const floorId = searchParams.get("floorId");
  const type = searchParams.get("type") as "employee" | "visitor" | null;

  const query: FilterQuery<IAttendance> = {};

  if (fromDate || toDate) {
    // The client sends absolute instants (start/end of the picked day in the
    // USER's timezone). Re-applying setHours() here would use the server's
    // timezone — UTC on Vercel — which cut an MYT end date at 07:59 local.
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    if (
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime()))
    ) {
      return badRequest(strings.invalidDate);
    }

    query.checkedInAt = {} as FilterQuery<IAttendance>["checkedInAt"];
    if (from) query.checkedInAt.$gte = from;
    if (to) query.checkedInAt.$lte = to;
  }

  if (floorId) query.floorId = floorId;
  if (type) query.type = type;

  try {
    // Scope based on role, applied AFTER the filters so a floorId/type param
    // can only narrow the result. Precedence lives in getReportsScope():
    // all → department → own unit → own floor → none. An unresolvable scope
    // (e.g. floor head without a home floor) yields no records at all.
    const scoped = await scopeFilter(user, getReportsScope(user.role));
    if (!scoped) {
      return success({ records: [] });
    }

    // Scope is applied last so request params can only narrow the query
    Object.assign(query, scoped);

    const records = await Attendance.find(query)
      .populate("userId", "name role")
      .populate("floorId", "name")
      .sort({ checkedInAt: -1 })
      .limit(REPORT_PAGE_SIZE)
      .lean();

    return success({
      records,
      rowCount: records.length,
      pageSize: REPORT_PAGE_SIZE,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return serverError();
  }
}