import { NextResponse } from "next/server";
import type { FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  serverError,
  success,
  escapeRegex,
} from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";
import User from "@/lib/db/models/User";
import { IAttendance } from "@/lib/db/types";
import { getAttendanceScope } from "@/lib/auth/rbac";
import { scopeFilter } from "@/lib/auth/scope";

/** Rows per request — `page=` slices the result set by this size. */
const ATTENDANCE_PAGE_SIZE = 200;
/** Hard ceiling (the evacuation view asks for the whole building at once). */
const ATTENDANCE_PAGE_MAX = 1000;

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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
  const page = positiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(
    positiveInt(searchParams.get("pageSize"), ATTENDANCE_PAGE_SIZE),
    ATTENDANCE_PAGE_MAX
  );
  const q = searchParams.get("q")?.trim() ?? "";

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

  // Server-side search. Employee names live on the User document (populated
  // at read time), so resolve the matching employees first and OR that with
  // the visitor-name column — filtering in the browser only ever searched
  // the rows already on the page.
  if (q) {
    const pattern = escapeRegex(q);
    const matchingUsers = await User.find({
      name: { $regex: pattern, $options: "i" },
    })
      .select("_id")
      .lean();

    query.$and = [
      {
        $or: [
          { userId: { $in: matchingUsers.map((u) => u._id) } },
          { visitorName: { $regex: pattern, $options: "i" } },
        ],
      },
    ];
  }

  // Scope based on role. Applied AFTER the request filters so query params
  // can only narrow a scoped query, never widen it. A scope that cannot be
  // resolved (no unit, no jabatan, no home floor) returns no data at all.
  const emptyResult = {
    attendance: [] as unknown[],
    total: 0,
    totalEmployees: 0,
    totalVisitors: 0,
    totalPresent: 0,
    lastUpdated: new Date().toISOString(),
    rowCount: 0,
    pageSize,
    page,
  };

  try {
    // The floor-wide slice exists for the LIVE board only; historical
    // queries stay personal (own records). Otherwise a plain employee could
    // pull their whole floor's past straight from this endpoint.
    const roleScope = getAttendanceScope(user.role);
    const effectiveScope =
      roleScope === "own_and_floor" && !activeOnly ? "own" : roleScope;

    const scoped = await scopeFilter(user, effectiveScope);

    if (!scoped) {
      return success(emptyResult);
    }

    // Scope is applied last so request params can only narrow the query
    Object.assign(query, scoped);

    // Totals are counted over the WHOLE (scoped, filtered) result set — not
    // over the rows returned below, which are one page of ATTENDANCE_PAGE_SIZE.
    const baseActive = { ...query, checkedOutAt: null };
    const countActive = (t: "employee" | "visitor") =>
      query.type && query.type !== t
        ? Promise.resolve(0)
        : Attendance.countDocuments({ ...baseActive, type: t });

    const [attendance, total, totalEmployees, totalVisitors] = await Promise.all([
      Attendance.find(query)
        // Phone numbers are collected for identity/deduplication only — they
        // are not needed to draw a presence list, so they are not returned.
        .select("-visitorPhone")
        .populate("userId", "name role")
        .populate("floorId", "name")
        .sort({ checkedInAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Attendance.countDocuments(query),
      countActive("employee"),
      countActive("visitor"),
    ]);

    return success({
      attendance,
      /** Rows matching the filters across ALL pages. */
      total,
      totalEmployees,
      totalVisitors,
      totalPresent: totalEmployees + totalVisitors,
      lastUpdated: new Date().toISOString(),
      /** Rows on THIS page (capped at pageSize). */
      rowCount: attendance.length,
      pageSize,
      page,
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return serverError();
  }
}
