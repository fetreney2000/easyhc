import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";

/**
 * One-time setup endpoint to create the first superadmin account.
 * Only works if no users exist in the database.
 * POST /api/setup
 */
export async function POST(request: Request) {
  await connectDB();

  // Check if any users already exist
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    return NextResponse.json(
      { error: "Sistem telah dikonfigurasi. Pengguna sudah wujud." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, username, password } = body;

    if (!name || !username || !password) {
      return NextResponse.json(
        { error: "Semua medan diperlukan: nama, nama pengguna, kata laluan" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Kata laluan mestilah sekurang-kurangnya 8 aksara" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const superadmin = await User.create({
      name,
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
    console.error("Error creating superadmin:", error);
    return NextResponse.json(
      { error: "Ralat pelayan dalaman" },
      { status: 500 }
    );
  }
}