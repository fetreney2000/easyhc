import { NextResponse } from "next/server";
import { strings } from "@/lib/i18n/strings";
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
import { decryptQrPayload } from "@/lib/qr/token";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  await connectDB();

  try {
    const body = await request.json();
    const { qrToken, method = "qr" } = body;

    if (method !== "manual" && (typeof qrToken !== "string" || !qrToken.trim())) {
      return badRequest(strings.qrTokenRequired);
    }

    // Manual check-in is only for admin/superadmin
    if (method === "manual" && !can(user.role, "attendance:manual_checkin")) {
      return forbidden();
    }

    // Find the floor: manual check-in uses floorId directly, QR uses encrypted token
    let floor = null;

    if (method === "manual") {
      // Manual check-in: floorId is sent directly in the body
      const { floorId } = body;
      if (!floorId) {
        return badRequest(strings.manualCheckinFloorRequired);
      }
      floor = await Floor.findById(floorId);
    } else {
      // QR check-in. Only the floor's rotating qrToken is accepted — either
      // wrapped in the encrypted employee payload or scanned as-is from a
      // visitor URL. Raw floor ids are deliberately NOT accepted: they are
      // public (GET /api/floors) and are not a proof of having scanned.
      const decryptedToken = decryptQrPayload(qrToken);

      if (decryptedToken) {
        floor = await Floor.findOne({ qrToken: decryptedToken });
      }

      if (!floor) {
        floor = await Floor.findOne({ qrToken });
      }

      if (!floor) {
        return badRequest(strings.invalidQrCode);
      }
    }

    if (!floor) {
      return badRequest(method === "manual" ? "Lantai tidak dijumpai" : "Kod QR tidak sah");
    }

    // For manual check-in, the target user is selected by the admin
    const targetUserId = method === "manual" ? body.userId : user.id;

    if (method === "manual" && !targetUserId) {
      return badRequest(strings.manualCheckinUserRequired);
    }

    // Check if target user already has an open attendance record on THIS floor (toggle behavior)
    const existingOnThisFloor = await Attendance.findOne({
      userId: targetUserId,
      floorId: floor._id,
      checkedOutAt: null,
      type: "employee",
    });

    if (existingOnThisFloor) {
      // Already on this floor → CHECK OUT (toggle)
      existingOnThisFloor.checkedOutAt = new Date();
      existingOnThisFloor.checkedOutBy = "self";
      await existingOnThisFloor.save();

      return success({
        message: `Berjaya daftar keluar dari ${floor.name}`,
        action: "checkout",
        attendance: {
          _id: existingOnThisFloor._id,
          floorName: floor.name,
        },
      });
    }

    // Not on this floor → CHECK IN
    // First, auto-checkout target user from any other floor
    const existingOnOtherFloor = await Attendance.findOne({
      userId: targetUserId,
      checkedOutAt: null,
      type: "employee",
    });

    if (existingOnOtherFloor) {
      existingOnOtherFloor.checkedOutAt = new Date();
      existingOnOtherFloor.checkedOutBy = method === "manual" ? "self" : user.id;
      await existingOnOtherFloor.save();
    }

    // Create new attendance record for the target user
    const attendance = await Attendance.create({
      type: "employee",
      userId: targetUserId,
      floorId: floor._id,
      checkedInAt: new Date(),
      method,
    });

    // Audit log for manual check-in
    if (method === "manual") {
      await AuditLog.create({
        actorUserId: user.id,
        action: "manual_checkin",
        targetId: targetUserId,
        metadata: {
          floorId: floor._id.toString(),
          floorName: floor.name,
        },
      });
    }

    return success(
      {
        message: `Berjaya daftar masuk ke ${floor.name}`,
        action: "checkin",
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