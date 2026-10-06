import { connectDB } from "@/lib/db/mongoose";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  unauthorized,
  badRequest,
  serverError,
  success,
} from "@/lib/api/utils";
import User from "@/lib/db/models/User";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { checkRateLimit, resetRateLimit } from "@/lib/security/rateLimit";
import { strings } from "@/lib/i18n/strings";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return unauthorized();

  // Throttle current-password guessing against this account
  const rateKey = `pwchg:${authUser.id}`;
  const rate = checkRateLimit(rateKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: strings.tooManyAttempts },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  await connectDB();

  try {
    const body = await request.json();

    // Same schema the profile form validates against: min length, required
    // fields and new/confirm must match — enforced server-side too.
    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      return badRequest(validation.error.errors[0].message);
    }

    const { currentPassword, newPassword } = validation.data;

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

    resetRateLimit(rateKey);

    return success({ message: "Kata laluan berjaya ditukar" });
  } catch (error) {
    console.error("Error changing password:", error);
    return serverError();
  }
}