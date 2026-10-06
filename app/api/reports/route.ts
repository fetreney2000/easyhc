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

/** Default page size for the table view; MAX also caps the CSV export. */
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 5000;

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pageSizeParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

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
  const page = positiveInt(searchParams.get("page"), 1);
  const pageSize = pageSizeParam(searchParams.get("pageSize"));

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
      return success({ records: [], total: 0, rowCount: 0, pageSize, page });
    }

    // Scope is applied last so request params can only narrow the query
    Object.assign(query, scoped);

    // One page of rows for the table + the total match count for the pager
    const [records, total] = await Promise.all([
      Attendance.find(query)
        // Phone numbers are identity/deduplication data, not report content
        .select("-visitorPhone")
        .populate("userId", "name role")
        .populate("floorId", "name")
        .sort({ checkedInAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Attendance.countDocuments(query),
    ]);

    return success({
      records,
      /** Rows matching the filters across ALL pages. */
      total,
      rowCount: records.length,
      pageSize,
      page,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return serverError();
  }
}