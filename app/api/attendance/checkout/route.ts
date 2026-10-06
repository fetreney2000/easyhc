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
import { getCheckoutScope } from "@/lib/auth/rbac";
import { canForceCheckoutRecord } from "@/lib/auth/scope";

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

    // If force checkout, resolve the actor's scope and verify that THIS
    // record falls inside it (member of their unit/department, or on their
    // home floor). Holding any checkout permission is not enough by itself.
    if (force) {
      const scope = getCheckoutScope(user.role);
      if (scope === "none") {
        return forbidden();
      }

      const inScope = await canForceCheckoutRecord(user, record);
      if (!inScope) {
        return forbidden();
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
          scope,
        },
      });
    } else {
      // Self checkout: only your own employee record. Visitor records are
      // closed through the token-checked public visitor endpoint instead,
      // so a logged-in user can never close someone else's record here.
      if (record.type !== "employee" || record.userId?.toString() !== user.id) {
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