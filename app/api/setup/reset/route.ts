import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { secureCompare } from "@/lib/api/utils";
import { strings } from "@/lib/i18n/strings";
import User from "@/lib/db/models/User";

/**
 * Reset/create superadmin account.
 * Protected by CRON_SECRET to prevent unauthorized access.
 * POST /api/setup/reset
 * Body: { "secret": "your-cron-secret", "username": "superadmin", "password": "newpassword" }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret, username, password, name } = body;

    // Fail CLOSED: if CRON_SECRET is not configured this endpoint stays
    // locked rather than accepting an absent secret.
    if (!secureCompare(secret, process.env.CRON_SECRET)) {
      return NextResponse.json(
        { error: strings.invalidSecret },
        { status: 403 }
      );
    }

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: strings.setupCredentialsRequired },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: strings.passwordMinLength },
        { status: 400 }
      );
    }

    // Only connect once the caller has proven knowledge of the secret
    await connectDB();

    const passwordHash = await bcrypt.hash(password, 12);

    // Drop old indexes from schema migration (staffId, email from NextAuth adapter)
    for (const idxName of ["staffId_1", "email_1"]) {
      try {
        await User.collection.dropIndex(idxName);
        console.log("Dropped old index:", idxName);
      } catch {
        // Index might not exist, ignore
      }
    }

    // Find existing superadmin or create new one
    let superadmin = await User.findOne({ username: username.toLowerCase().trim() });
    
    if (superadmin) {
      // Update existing user
      superadmin.passwordHash = passwordHash;
      superadmin.name = name || superadmin.name;
      superadmin.role = "superadmin";
      superadmin.status = "active";
      superadmin.sessionVersion += 1; // Invalidate all sessions
      await superadmin.save();
      
      return NextResponse.json({
        message: "Kata laluan superadmin berjaya ditetap semula",
        user: {
          id: superadmin._id,
          name: superadmin.name,
          username: superadmin.username,
          role: superadmin.role,
        },
      });
    }

    // Create new superadmin
    superadmin = await User.create({
      name: name || "Super Admin",
      username: username.toLowerCase().trim(),
      passwordHash,
      role: "superadmin",
      status: "active",
      sessionVersion: 0,
    });

    return NextResponse.json(
      {
        message: strings.superadminCreated,
        user: {
          id: superadmin._id,
          name: superadmin.name,
          username: superadmin.username,
          role: superadmin.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error resetting superadmin:", error);
    return NextResponse.json(
      { error: "Ralat pelayan dalaman" },
      { status: 500 }
    );
  }
}