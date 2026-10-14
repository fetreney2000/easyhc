import { NextResponse } from "next/server";
import { Types } from "mongoose";
import type { FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { strings } from "@/lib/i18n/strings";
import {
  getAuthenticatedUser,
  unauthorized,
  badRequest,
  serverError,
  success,
  escapeRegex,
  isCastError,
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
/**
 * The recent check-OUTS feed's exact shape ("Daftar Keluar Terkini": page 1,
 * a handful of rows). own_and_floor roles keep their floor scope in THIS
 * shape — the feed sits beside the arrivals feed and must behave the same
 * way — while any other checkedOut query is history and stays personal.
 */
const FEED_PAGE_MAX = 10;

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
  const checkedOut = searchParams.get("checkedOut") === "true";

  const query: FilterQuery<IAttendance> = {};

  if (checkedOut) {
    // Recent check-outs feed (the dashboard's "Daftar Keluar Terkini"):
    // part of the LIVE board, so it keeps the live scope and gets a
    // newest-checked-OUT-first ordering below. `active=true` is ignored
    // when this is set.
    query.checkedOutAt = { $ne: null };
  } else if (activeOnly) {
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
    byFloor: [] as { floorId: Types.ObjectId | null; count: number }[],
    lastUpdated: new Date().toISOString(),
    rowCount: 0,
    pageSize,
    page,
  };

  try {
    // The floor-wide slice exists for two BOUNDED views: the live board
    // (current presence) and its recent check-OUTs feed — "Daftar Keluar
    // Terkini" must show a plain employee their floor's departures exactly
    // like "Daftar Masuk Terkini" shows the arrivals. Beyond those shapes
    // (paging, larger pages, a search narrowing the window, anything
    // else) a historical query degrades to "own", so nobody can walk
    // their floor's past per-person through this endpoint.
    const roleScope = getAttendanceScope(user.role);
    const feedBounded =
      checkedOut && page === 1 && pageSize <= FEED_PAGE_MAX && !q;
    const effectiveScope =
      roleScope === "own_and_floor" &&
      !(activeOnly && !checkedOut) &&
      !feedBounded
        ? "own"
        : roleScope;

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

    // Per-floor headcounts over the WHOLE live board (not the current page)
    // — the dashboard's floor strip must agree with the totals above, even
    // when the user has paged the table. Aggregation $match does not cast,
    // so the string floorId filter is converted here.
    const boardActive = activeOnly && !checkedOut;
    const byFloor = boardActive
      ? Attendance.aggregate<{ _id: Types.ObjectId | null; count: number }>(
          [
            {
              $match: {
                ...baseActive,
                ...(query.floorId
                  ? { floorId: new Types.ObjectId(String(query.floorId)) }
                  : {}),
              } as Record<string, unknown>,
            },
            { $group: { _id: "$floorId", count: { $sum: 1 } } },
          ]
        ).then((rows) =>
          rows.map((row) => ({ floorId: row._id, count: row.count }))
        )
      : Promise.resolve([]);

    // The bounded feed view is NOT pageable: its envelope reports the rows
    // it carries instead of leaking the floor's all-time history COUNT
    // (and skips a needless countDocuments on every poll)
    const feedEnvelopeClamp = roleScope === "own_and_floor" && feedBounded;

    const [attendance, totalRaw, totalEmployees, totalVisitors, floorCounts] =
      await Promise.all([
        Attendance.find(query)
          // Phone numbers are collected for identity/deduplication only —
          // they are not needed to draw a presence list, so they are not
          // returned.
          .select("-visitorPhone")
          .populate("userId", "name role")
          .populate("floorId", "name hue")
          .sort(checkedOut ? { checkedOutAt: -1 } : { checkedInAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        feedEnvelopeClamp
          ? Promise.resolve(-1)
          : Attendance.countDocuments(query),
        countActive("employee"),
        countActive("visitor"),
        byFloor,
      ]);
    const total = totalRaw < 0 ? attendance.length : totalRaw;

    return success({
      attendance,
      /** Rows matching the filters across ALL pages (the bounded feed
       *  view reports the rows it carries — see feedEnvelopeClamp). */
      total,
      totalEmployees,
      totalVisitors,
      totalPresent: totalEmployees + totalVisitors,
      /** Live board only: headcount per floor across ALL pages. */
      byFloor: floorCounts,
      lastUpdated: new Date().toISOString(),
      /** Rows on THIS page (capped at pageSize). */
      rowCount: attendance.length,
      pageSize,
      page,
    });
  } catch (error) {
    if (isCastError(error)) return badRequest(strings.invalidId);
    console.error("Error fetching attendance:", error);
    return serverError();
  }
}
