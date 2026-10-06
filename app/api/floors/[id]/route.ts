import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  success,
} from "@/lib/api/utils";
import Floor from "@/lib/db/models/Floor";
import Attendance from "@/lib/db/models/Attendance";
import { can } from "@/lib/auth/rbac";
import { updateFloorSchema } from "@/lib/validation/schemas";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  await connectDB();

  try {
    const floor = await Floor.findById(params.id).lean();
    if (!floor) return badRequest("Lantai tidak dijumpai");

    // qrToken authorises check-in → only floor managers may read it
    if (!can(user.role, "floors:manage")) {
      const { qrToken: _token, ...safeFloor } = floor;
      return success(safeFloor);
    }

    return success(floor);
  } catch (error) {
    console.error("Error fetching floor:", error);
    return serverError();
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "floors:manage")) return forbidden();

  await connectDB();

  try {
    const body = await request.json();
    const validation = updateFloorSchema.safeParse(body);
    if (!validation.success) {
      return badRequest(validation.error.errors[0].message);
    }

    const floor = await Floor.findById(params.id);
    if (!floor) return badRequest("Lantai tidak dijumpai");

    // Check duplicate name
    const existing = await Floor.findOne({
      name: validation.data.name,
      _id: { $ne: params.id },
    });
    if (existing) return badRequest("Nama lantai sudah wujud");

    floor.name = validation.data.name;
    await floor.save();

    return success(floor);
  } catch (error) {
    console.error("Error updating floor:", error);
    return serverError();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "floors:manage")) return forbidden();

  await connectDB();

  try {
    const floor = await Floor.findById(params.id);
    if (!floor) return badRequest("Lantai tidak dijumpai");

    // Never orphan attendance history: it is exactly what a muster report
    // depends on. Active check-ins block first; older history blocks until
    // the daily cron purges it (ATTENDANCE_RETENTION_DAYS).
    const [activeCount, totalCount] = await Promise.all([
      Attendance.countDocuments({ floorId: floor._id, checkedOutAt: null }),
      Attendance.countDocuments({ floorId: floor._id }),
    ]);

    if (activeCount > 0) {
      return badRequest(
        `Masih ada ${activeCount} orang berdaftar masuk di lantai ini. Daftar keluar mereka sebelum memadam.`
      );
    }
    if (totalCount > 0) {
      return badRequest(
        `Lantai ini masih mempunyai ${totalCount} rekod kehadiran (sejarah) dan tidak boleh dipadam.`
      );
    }

    await Floor.findByIdAndDelete(params.id);

    return success({ message: "Lantai berjaya dipadam" });
  } catch (error) {
    console.error("Error deleting floor:", error);
    return serverError();
  }
}

// Regenerate QR token
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "floors:manage")) return forbidden();

  await connectDB();

  try {
    const floor = await Floor.findById(params.id);
    if (!floor) return badRequest("Lantai tidak dijumpai");

    floor.qrToken = crypto.randomUUID();
    await floor.save();

    return success(floor);
  } catch (error) {
    console.error("Error regenerating QR:", error);
    return serverError();
  }
}