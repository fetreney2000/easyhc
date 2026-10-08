import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { strings } from "@/lib/i18n/strings";
import User from "@/lib/db/models/User";

/**
 * One-time setup endpoint to create the first superadmin account.
 * Only works while no users exist in the database.
 * POST /api/setup
 *
 * Two guards, both required:
 *   1. no users may exist yet, and
 *   2. an atomic claim on the `_setup` singleton collection, so two
 *      concurrent requests can never both create a superadmin.
 * Index maintenance is deliberately NOT done here — this endpoint is
 * unauthenticated and must never mutate indexes (see /api/setup/reset).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, username, password } = body;

    if (
      typeof name !== "string" ||
      typeof username !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !username.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: strings.setupMissingFields },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: strings.passwordMinLength },
        { status: 400 }
      );
    }

    await connectDB();

    // Guard 1: only a brand-new, unconfigured database
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return NextResponse.json(
        { error: strings.systemInitialized },
        { status: 403 }
      );
    }

    // Guard 2: atomic claim (duplicate _id → someone else won the race)
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: strings.serverError },
        { status: 500 }
      );
    }
    const flags = db.collection<{ _id: string }>("_setup");
    let claimed = false;
    try {
      await flags.insertOne({ _id: "superadmin_created" });
      claimed = true;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        claimed = false;
      } else {
        throw error;
      }
    }

    if (!claimed) {
      return NextResponse.json(
        { error: strings.systemInitialized },
        { status: 403 }
      );
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12);

      const superadmin = await User.create({
        name: name.trim(),
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
      // Creation failed → release the claim so setup can be retried
      await flags.deleteOne({ _id: "superadmin_created" }).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Error creating superadmin:", error);
    return NextResponse.json(
      { error: strings.serverError },
      { status: 500 }
    );
  }
}
