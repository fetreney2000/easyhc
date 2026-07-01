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
import Floor from "@/lib/db/models/Floor";
import AuditLog from "@/lib/db/models/AuditLog";
import { can } from "@/lib/auth/rbac";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  await connectDB();

  try {
    const body = await request.json();
    const { qrToken, method = "qr" } = body;

    if (!qrToken) {
      return badRequest("Token QR diperlukan");
    }

    // Manual check-in is only for admin/superadmin
    if (method === "manual" && !can(user.role, "attendance:manual_checkin")) {
      return forbidden();
    }

    // Find the floor by QR token
    const floor = await Floor.findOne({ qrToken });
    if (!floor) {
      return badRequest("Kod QR tidak sah");
    }

    // Check if user already has an open attendance record
    const existingRecord = await Attendance.findOne({
      userId: user.id,
      checkedOutAt: null,
      type: "employee",
    });

    if (existingRecord) {
      // Auto-checkout from previous floor
      existingRecord.checkedOutAt = new Date();
      existingRecord.checkedOutBy = "self";
      await existingRecord.save();
    }

    // Create new attendance record
    const attendance = await Attendance.create({
      type: "employee",
      userId: user.id,
      floorId: floor._id,
      checkedInAt: new Date(),
      method,
    });

    // Audit log for manual check-in
    if (method === "manual") {
      await AuditLog.create({
        actorUserId: user.id,
        action: "manual_checkin",
        targetId: user.id,
        metadata: {
          floorId: floor._id.toString(),
          floorName: floor.name,
        },
      });
    }

    return success(
      {
        message: `Berjaya daftar masuk ke ${floor.name}`,
        attendance: {
          _id: attendance._id,
          floorName: floor.name,
          checkedInAt: attendance.checkedInAt,
        },
      },
      201
    );
  } catch (error) {
    console.error("Error checking in:", error);
    return serverError();
  }
}