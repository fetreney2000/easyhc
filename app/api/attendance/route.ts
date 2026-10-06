import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getAuthenticatedUser, unauthorized, serverError, success } from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";
import { getAttendanceScope } from "@/lib/auth/rbac";
import { scopeFilter } from "@/lib/auth/scope";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {};

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
    attendance: [],
    totalEmployees: 0,
    totalVisitors: 0,
    totalPresent: 0,
    lastUpdated: new Date().toISOString(),
  };

  try {
    const scoped = await scopeFilter(user, getAttendanceScope(user.role));

    if (!scoped) {
      return success(emptyResult);
    }

    if (scoped.$or) {
      query.$or = scoped.$or;
    } else {
      Object.assign(query, scoped);
    }

    const attendance = await Attendance.find(query)
      .populate("userId", "name role")
      .populate("floorId", "name")
      .sort({ checkedInAt: -1 })
      .limit(200)
      .lean();

    const totalEmployees = attendance.filter(
      (a) => a.type === "employee" && !a.checkedOutAt
    ).length;
    const totalVisitors = attendance.filter(
      (a) => a.type === "visitor" && !a.checkedOutAt
    ).length;

    return success({
      attendance,
      totalEmployees,
      totalVisitors,
      totalPresent: totalEmployees + totalVisitors,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return serverError();
  }
}