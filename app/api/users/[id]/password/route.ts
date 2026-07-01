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

export async function POST(request: Request) {
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

    // Find user by ID first, fall back to username
    let user = await User.findById(authUser.id);
    if (!user) {
      user = await User.findOne({ username: authUser.username });
    }
    if (!user) {
      return badRequest("Pengguna tidak dijumpai. Sila log keluar dan log masuk semula.");
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return badRequest("Kata laluan semasa salah");
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.sessionVersion += 1;
    await user.save();

    return success({ message: "Kata laluan berjaya ditukar" });
  } catch (error) {
    console.error("Error changing password:", error);
    return serverError();
  }
}