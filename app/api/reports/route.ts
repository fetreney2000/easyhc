import { NextResponse } from "next/server";
import type { FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  serverError,
  success,
} from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";
import { IAttendance } from "@/lib/db/types";
import { can, getReportsScope } from "@/lib/auth/rbac";
import { scopeFilter } from "@/lib/auth/scope";

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
    query.checkedInAt = {} as FilterQuery<IAttendance>["checkedInAt"];
    if (fromDate) query.checkedInAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.checkedInAt.$lte = end;
    }
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
      .limit(1000)
      .lean();

    return success({ records });
  } catch (error) {
    console.error("Error generating report:", error);
    return serverError();
  }
}