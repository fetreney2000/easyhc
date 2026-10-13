import { connectDB } from "@/lib/db/mongoose";
import { strings } from "@/lib/i18n/strings";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  success,
  isCastError,
} from "@/lib/api/utils";
import Floor from "@/lib/db/models/Floor";
import Attendance from "@/lib/db/models/Attendance";
import Unit from "@/lib/db/models/Unit";
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
    if (!floor) return badRequest(strings.floorNotFound);

    // qrToken authorises check-in → only floor managers may read it
    if (!can(user.role, "floors:manage")) {
      const { qrToken: _token, ...safeFloor } = floor;
      return success(safeFloor);
    }

    return success(floor);
  } catch (error) {
    if (isCastError(error)) return badRequest(strings.invalidId);
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
    if (!floor) return badRequest(strings.floorNotFound);

    // Check duplicate name
    const existing = await Floor.findOne({
      name: validation.data.name,
      _id: { $ne: params.id },
    });
    if (existing) return badRequest(strings.floorExists);

    floor.name = validation.data.name;
    await floor.save();

    return success(floor);
  } catch (error) {
    if (isCastError(error)) return badRequest(strings.invalidId);
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
    if (!floor) return badRequest(strings.floorNotFound);

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

    // …and never leave a unit pointing at a floor that no longer exists:
    // the members' own_floor scope would silently resolve to a ghost and
    // their board and reports would come back empty with no error.
    const unitCount = await Unit.countDocuments({ homeFloorId: floor._id });
    if (unitCount > 0) {
      return badRequest(
        `Lantai ini masih menjadi lantai rumah bagi ${unitCount} unit. Tukar lantai rumah unit tersebut sebelum memadam.`
      );
    }

    await Floor.findByIdAndDelete(params.id);

    return success({ message: strings.floorDeleted });
  } catch (error) {
    if (isCastError(error)) return badRequest(strings.invalidId);
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
    if (!floor) return badRequest(strings.floorNotFound);

    // Keep the outgoing token: a scan of the poster this rotation just
    // revoked can then be reported as ROTATED rather than plainly invalid
    floor.prevQrToken = floor.qrToken;
    floor.qrToken = crypto.randomUUID();
    await floor.save();

    return success(floor);
  } catch (error) {
    if (isCastError(error)) return badRequest(strings.invalidId);
    console.error("Error regenerating QR:", error);
    return serverError();
  }
}