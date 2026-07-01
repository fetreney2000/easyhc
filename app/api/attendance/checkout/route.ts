import { NextResponse } from "next/server";
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
import AuditLog from "@/lib/db/models/AuditLog";
import { can } from "@/lib/auth/rbac";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  await connectDB();

  const body = await request.json();
  const { attendanceId, force } = body;

  if (!attendanceId) {
    return badRequest("ID kehadiran diperlukan");
  }

  try {
    const record = await Attendance.findById(attendanceId);
    if (!record) {
      return badRequest("Rekod kehadiran tidak dijumpai");
    }

    if (record.checkedOutAt) {
      return badRequest("Pengguna ini sudah didaftar keluar");
    }

    // If force checkout, check permissions
    if (force) {
      const hasForcePermission =
        can(user.role, "attendance:checkout_all") ||
        can(user.role, "attendance:checkout_own_floor") ||
        can(user.role, "attendance:checkout_own_unit") ||
        can(user.role, "attendance:checkout_department");

      if (!hasForcePermission) {
        return forbidden();
      }

      // Additional scope check for floor_head
      if (
        can(user.role, "attendance:checkout_own_floor") &&
        !can(user.role, "attendance:checkout_all")
      ) {
        // Verify the floor is in the user's unit's home floor
        const Unit = (await import("@/lib/db/models/Unit")).default;
        const unit = await Unit.findById(user.unitId).lean();
        if (
          !unit?.homeFloorId ||
          unit.homeFloorId.toString() !== record.floorId.toString()
        ) {
          return forbidden();
        }
      }

      // Audit log for force checkout
      await AuditLog.create({
        actorUserId: user.id,
        action: "force_checkout",
        targetId: record.userId || record._id,
        metadata: {
          attendanceId: record._id.toString(),
          floorId: record.floorId.toString(),
          type: record.type,
        },
      });
    } else {
      // Self checkout - verify the record belongs to the user
      if (
        record.type === "employee" &&
        record.userId?.toString() !== user.id
      ) {
        return forbidden();
      }
    }

    record.checkedOutAt = new Date();
    record.checkedOutBy = force ? user.id : "self";
    await record.save();

    return success({
      message: force
        ? "Berjaya memaksa keluar"
        : "Berjaya daftar keluar",
    });
  } catch (error) {
    console.error("Error checking out:", error);
    return serverError();
  }
}