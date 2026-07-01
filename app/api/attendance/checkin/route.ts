import { NextResponse } from "next/server";
import crypto from "crypto";
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

const ENCRYPTION_KEY = process.env.NEXTAUTH_SECRET || "default-key";

function decryptFloorId(encrypted: string): string | null {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)),
      Buffer.from(ENCRYPTION_KEY.padEnd(16, "0").slice(0, 16))
    );
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

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

    // Try to find the floor by decrypting the QR token (employee QR)
    let floor = null;

    // First, try to decrypt as encrypted floor ID
    const decryptedFloorId = decryptFloorId(qrToken);
    if (decryptedFloorId) {
      floor = await Floor.findById(decryptedFloorId);
    }

    // If not found, try as qrToken (visitor QR token)
    if (!floor) {
      floor = await Floor.findOne({ qrToken });
    }

    // If still not found, try as raw floor ID
    if (!floor) {
      floor = await Floor.findById(qrToken);
    }

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