import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  serverError,
  success,
} from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {};

  if (fromDate || toDate) {
    query.checkedInAt = {};
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

    if (scoped.$or) {
      query.$or = scoped.$or;
    } else {
      Object.assign(query, scoped);
    }

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