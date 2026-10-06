import { NextResponse } from "next/server";
import type { FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { getAuthenticatedUser, unauthorized, serverError, success } from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";
import { IAttendance } from "@/lib/db/types";
import { getAttendanceScope } from "@/lib/auth/rbac";
import { scopeFilter } from "@/lib/auth/scope";

/** Rows returned per request; totals are counted separately (see below). */
const ATTENDANCE_PAGE_SIZE = 200;

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  await connectDB();

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "true";
  const floorId = searchParams.get("floorId");
  const type = searchParams.get("type") as "employee" | "visitor" | null;

  const query: FilterQuery<IAttendance> = {};

  if (activeOnly) {
    query.checkedOutAt = null;
  }

  if (floorId) {
    query.floorId = floorId;
  }

  if (type) {
    query.type = type;
  }

  // Scope based on role. Applied AFTER the request filters so query params
  // can only narrow a scoped query, never widen it. A scope that cannot be
  // resolved (no unit, no jabatan, no home floor) returns no data at all.
  const emptyResult = {
    attendance: [] as unknown[],
    totalEmployees: 0,
    totalVisitors: 0,
    totalPresent: 0,
    lastUpdated: new Date().toISOString(),
    rowCount: 0,
    pageSize: ATTENDANCE_PAGE_SIZE,
  };

  try {
    const scoped = await scopeFilter(user, getAttendanceScope(user.role));

    if (!scoped) {
      return success(emptyResult);
    }

    // Scope is applied last so request params can only narrow the query
    Object.assign(query, scoped);

    const attendance = await Attendance.find(query)
      .populate("userId", "name role")
      .populate("floorId", "name")
      .sort({ checkedInAt: -1 })
      .limit(ATTENDANCE_PAGE_SIZE)
      .lean();

    // Totals are counted over the WHOLE (scoped, filtered) result set — not
    // over the rows returned above, which are capped at ATTENDANCE_PAGE_SIZE.
    const baseActive = { ...query, checkedOutAt: null };
    const countActive = (type: "employee" | "visitor") =>
      query.type && query.type !== type
        ? Promise.resolve(0)
        : Attendance.countDocuments({ ...baseActive, type });

    const [totalEmployees, totalVisitors] = await Promise.all([
      countActive("employee"),
      countActive("visitor"),
    ]);

    return success({
      attendance,
      totalEmployees,
      totalVisitors,
      totalPresent: totalEmployees + totalVisitors,
      lastUpdated: new Date().toISOString(),
      rowCount: attendance.length,
      pageSize: ATTENDANCE_PAGE_SIZE,
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return serverError();
  }
}