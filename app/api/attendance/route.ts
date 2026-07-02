import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getAuthenticatedUser, unauthorized, serverError, success } from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";
import { can } from "@/lib/auth/rbac";

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

  // Scope based on role
  if (!can(user.role, "attendance:view_all")) {
    if (can(user.role, "attendance:view_own_unit") && user.unitId) {
      // Unit head: show attendance for ALL users in their unit (on any floor)
      const Unit = (await import("@/lib/db/models/Unit")).default;
      const User = (await import("@/lib/db/models/User")).default;

      // Get unit users
      const unitUsers = await User.find({ unitId: user.unitId })
        .select("_id")
        .lean();
      const userIds = unitUsers.map((u) => u._id);

      // Also include the unit's home floor
      const unit = await Unit.findById(user.unitId).lean();

      // Query: unit users on any floor + home floor visitors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orConditions: any[] = [
        { userId: { $in: userIds } },
      ];
      if (unit?.homeFloorId) {
        orConditions.push({
          floorId: unit.homeFloorId.toString(),
          type: "visitor",
        });
      } else {
        orConditions.push({ type: "visitor" });
      }

      query.$or = orConditions;
    } else if (can(user.role, "attendance:view_own_floor") && user.unitId) {
      // Floor head: show attendance on their home floor only
      const Unit = (await import("@/lib/db/models/Unit")).default;
      const unit = await Unit.findById(user.unitId).lean();
      if (unit?.homeFloorId) {
        query.floorId = unit.homeFloorId.toString();
      }
    } else {
      // Regular user - own data only
      const mongoose = await import("mongoose");
      query.userId = new mongoose.Types.ObjectId(user.id);
    }
  }

  try {
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