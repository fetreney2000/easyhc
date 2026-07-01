import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";

/**
 * Reset/create superadmin account.
 * Protected by CRON_SECRET to prevent unauthorized access.
 * POST /api/setup/reset
 * Body: { "secret": "your-cron-secret", "username": "superadmin", "password": "newpassword" }
 */
export async function POST(request: Request) {
  await connectDB();

  try {
    const body = await request.json();
    const { secret, username, password, name } = body;

    // Verify secret matches CRON_SECRET
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Rahsia tidak sah" },
        { status: 403 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: "Nama pengguna dan kata laluan diperlukan" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Kata laluan mestilah sekurang-kurangnya 6 aksara" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

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
        message: "Superadmin berjaya dicipta",
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