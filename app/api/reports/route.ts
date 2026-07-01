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
import { can } from "@/lib/auth/rbac";

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

  // Scope based on role
  if (!can(user.role, "reports:generate_all")) {
    if (can(user.role, "reports:generate_own_floor") && user.unitId) {
      const Unit = (await import("@/lib/db/models/Unit")).default;
      const unit = await Unit.findById(user.unitId).lean();
      if (unit?.homeFloorId) {
        query.floorId = unit.homeFloorId.toString();
      }
    } else if (can(user.role, "reports:generate_own_unit") && user.unitId) {
      const User = (await import("@/lib/db/models/User")).default;
      const unitUsers = await User.find({ unitId: user.unitId })
        .select("_id")
        .lean();
      query.userId = { $in: unitUsers.map((u) => u._id) };
    }
  }

  try {
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