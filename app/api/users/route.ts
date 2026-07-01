import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  success,
} from "@/lib/api/utils";
import User from "@/lib/db/models/User";
import { can } from "@/lib/auth/rbac";
import { createUserSchema } from "@/lib/validation/schemas";
import { ROLES } from "@/lib/db/types";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  await connectDB();

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const search = searchParams.get("search");
  const unitId = searchParams.get("unitId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {};

  if (role) {
    query.role = role;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
    ];
  }

  if (unitId) {
    query.unitId = unitId;
  }

  try {
    // Scope based on role
    if (!can(user.role, "users:view_all")) {
      if (can(user.role, "users:view_own_unit") && user.unitId) {
        query.unitId = user.unitId;
      } else {
        // Regular user can only see themselves
        query._id = user.id;
      }
    }

    const users = await User.find(query)
      .select("name username phone role jabatanId unitId status createdAt")
      .populate("jabatanId", "name")
      .populate("unitId", "name")
      .sort({ name: 1 })
      .limit(500)
      .lean();

    return success(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return serverError();
  }
}

export async function POST(request: Request) {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return unauthorized();

  if (!can(authUser.role, "users:manage")) return forbidden();

  await connectDB();

  try {
    const body = await request.json();
    const validation = createUserSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.errors[0].message);
    }

    const data = validation.data;

    // Check if admin trying to create admin/superadmin
    if (
      authUser.role === "admin" &&
      (data.role === "admin" || data.role === "superadmin")
    ) {
      return forbidden();
    }

    // Check duplicate username
    const existingUser = await User.findOne({
      username: data.username,
    });
    if (existingUser) {
      return badRequest("Nama pengguna sudah wujud");
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const newUser = await User.create({
      name: data.name,
      username: data.username,
      passwordHash,
      phone: data.phone || undefined,
      role: data.role,
      jabatanId: data.jabatanId || undefined,
      unitId: data.unitId || undefined,
      status: data.status,
    });

    return success(
      {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        role: newUser.role,
      },
      201
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return serverError();
  }
}