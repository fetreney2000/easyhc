import { connectDB } from "@/lib/db/mongoose";
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
import AuditLog from "@/lib/db/models/AuditLog";
import { can } from "@/lib/auth/rbac";
import { resetPasswordSchema } from "@/lib/validation/schemas";

/**
 * Admin-initiated password reset for another user.
 * POST /api/users/[id]/reset-password   Body: { password }
 *
 * Requires users:manage. Bumping sessionVersion revokes every session that
 * user currently holds (see lib/auth/config.ts revocation check).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return unauthorized();
  if (!can(authUser.role, "users:manage")) return forbidden();

  await connectDB();

  try {
    const body = await request.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.errors[0].message);
    }

    // Own password always requires the current one — use the profile page
    if (params.id === authUser.id) {
      return badRequest(
        "Gunakan halaman Profil untuk menukar kata laluan anda sendiri"
      );
    }

    const target = await User.findById(params.id);
    if (!target) return badRequest("Pengguna tidak dijumpai");

    // Admins cannot reset a superadmin's password
    if (authUser.role === "admin" && target.role === "superadmin") {
      return forbidden();
    }

    target.passwordHash = await bcrypt.hash(validation.data.password, 12);
    target.sessionVersion += 1; // revoke all of this user's active sessions
    await target.save();

    await AuditLog.create({
      actorUserId: authUser.id,
      action: "reset_password",
      targetId: target._id,
    });

    return success({ message: "Kata laluan berjaya ditetap semula" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return serverError();
  }
}
