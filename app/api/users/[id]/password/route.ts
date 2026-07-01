import { connectDB } from "@/lib/db/mongoose";
import bcrypt from "bcryptjs";
import {
  getAuthenticatedUser,
  unauthorized,
  badRequest,
  serverError,
  success,
} from "@/lib/api/utils";
import User from "@/lib/db/models/User";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return unauthorized();

  await connectDB();

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return badRequest("Kata laluan semasa dan baharu diperlukan");
    }

    if (newPassword.length < 6) {
      return badRequest("Kata laluan baharu mestilah sekurang-kurangnya 6 aksara");
    }

    // Use authenticated user's ID directly instead of params
    const user = await User.findById(authUser.id);
    if (!user) return badRequest("Pengguna tidak dijumpai dalam pangkalan data.");

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return badRequest("Kata laluan semasa salah");
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.sessionVersion += 1; // Invalidate all sessions
    await user.save();

    return success({ message: "Kata laluan berjaya ditukar" });
  } catch (error) {
    console.error("Error changing password:", error);
    return serverError();
  }
}