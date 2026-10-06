import { connectDB } from "@/lib/db/mongoose";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  success,
} from "@/lib/api/utils";
import User from "@/lib/db/models/User";
import Attendance from "@/lib/db/models/Attendance";
import { can } from "@/lib/auth/rbac";
import { updateUserSchema, updateProfileSchema } from "@/lib/validation/schemas";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return unauthorized();

  await connectDB();

  // Users can view their own profile; admins can view anyone
  if (
    params.id !== authUser.id &&
    !can(authUser.role, "users:view_all")
  ) {
    return forbidden();
  }

  try {
    const user = await User.findById(params.id)
      .select("name username phone jawatanInfo role jabatanId unitId status createdAt")
      .populate("jabatanId", "name")
      .populate("unitId", "name")
      .lean();

    if (!user) return badRequest("Pengguna tidak dijumpai");
    return success(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return serverError();
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return unauthorized();

  await connectDB();

  // Users can edit their own profile (limited fields)
  // Admins can edit anyone
  const isOwnProfile = params.id === authUser.id;
  if (!isOwnProfile && !can(authUser.role, "users:manage")) {
    return forbidden();
  }

  try {
    const body = await request.json();
    const user = await User.findById(params.id);
    if (!user) return badRequest("Pengguna tidak dijumpai");

    // Admin can't edit superadmin
    if (
      authUser.role === "admin" &&
      user.role === "superadmin" &&
      !isOwnProfile
    ) {
      return forbidden();
    }

    if (isOwnProfile) {
      // Self-edit: validated and limited to name + phone. Role, status,
      // unit and jabatan can only be changed by someone with users:manage.
      const validation = updateProfileSchema.safeParse(body);
      if (!validation.success) {
        return badRequest(validation.error.errors[0].message);
      }

      user.name = validation.data.name;
      user.phone = validation.data.phone || undefined;
    } else {
      const validation = updateUserSchema.safeParse(body);
      if (!validation.success) {
        return badRequest(validation.error.errors[0].message);
      }
      const data = validation.data;

      // Admin can't assign admin/superadmin
      if (
        authUser.role === "admin" &&
        (data.role === "admin" || data.role === "superadmin")
      ) {
        return forbidden();
      }

      user.name = data.name;
      user.phone = data.phone || undefined;
      user.jawatanInfo = data.jawatanInfo || undefined;
      user.role = data.role;
      user.jabatanId = data.jabatanId && data.jabatanId !== "" ? new Types.ObjectId(data.jabatanId) : undefined;
      user.unitId = data.unitId && data.unitId !== "" ? new Types.ObjectId(data.unitId) : undefined;
      user.status = data.status;

      // Update password if provided
      if (data.password && data.password.length > 0) {
        user.passwordHash = await bcrypt.hash(data.password, 12);
        user.sessionVersion += 1; // Invalidate all sessions
      }
    }

    await user.save();

    return success({
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return serverError();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return unauthorized();
  if (!can(authUser.role, "users:manage")) return forbidden();

  await connectDB();

  try {
    const user = await User.findById(params.id);
    if (!user) return badRequest("Pengguna tidak dijumpai");

    // Can't delete yourself
    if (params.id === authUser.id) {
      return badRequest("Anda tidak boleh memadam akaun sendiri");
    }

    // Admin can't delete superadmin
    if (authUser.role === "admin" && user.role === "superadmin") {
      return forbidden();
    }

    // Keep muster history attributable: an account that has ever checked in
    // must be deactivated (status: inactive) instead of deleted, otherwise
    // attendance records lose the person they belong to.
    const attendanceCount = await Attendance.countDocuments({
      userId: user._id,
    });
    if (attendanceCount > 0) {
      return badRequest(
        `Pengguna ini mempunyai ${attendanceCount} rekod kehadiran. Tukar status kepada Tidak Aktif sebagai ganti memadam supaya sejarah kekal boleh dikenal pasti.`
      );
    }

    await User.findByIdAndDelete(params.id);

    return success({ message: "Pengguna berjaya dipadam" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return serverError();
  }
}