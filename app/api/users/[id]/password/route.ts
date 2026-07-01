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

  // Users can only change their own password
  if (params.id !== authUser.id) {
    return unauthorized();
  }

  await connectDB();

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return badRequest("Kata laluan semasa dan baharu diperlukan");
    }

    if (newPassword.length < 8) {
      return badRequest("Kata laluan baharu mestilah sekurang-kurangnya 8 aksara");
    }

    const user = await User.findById(params.id).select("+passwordHash");
    if (!user) return badRequest("Pengguna tidak dijumpai");

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