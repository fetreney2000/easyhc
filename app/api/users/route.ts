import { NextResponse } from "next/server";
import type { FilterQuery } from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  success,
  escapeRegex,
} from "@/lib/api/utils";
import User from "@/lib/db/models/User";
import Jabatan from "@/lib/db/models/Jabatan";
import Unit from "@/lib/db/models/Unit";
import { can, getUsersScope } from "@/lib/auth/rbac";
import { usersScopeFilter } from "@/lib/auth/scope";
import { createUserSchema } from "@/lib/validation/schemas";
import { ROLES, IUser, Role } from "@/lib/db/types";

/**
 * Rows returned when no paging is requested (the "give me the directory"
 * case used by the location maps and the manual check-in dropdown).
 * `page` + `limit` opt into paging for the management list.
 */
const USER_LIST_MAX = 10000;

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  await connectDB();

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const search = searchParams.get("search");
  const unitId = searchParams.get("unitId");
  const page = positiveInt(searchParams.get("page"), 1);
  const limit = Math.min(
    positiveInt(searchParams.get("limit"), USER_LIST_MAX),
    USER_LIST_MAX
  );

  const query: FilterQuery<IUser> = {};

  if (role) {
    query.role = role as Role;
  }

  if (search) {
    // Escape regex metacharacters: user input must never be a pattern
    const pattern = escapeRegex(search);
    query.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { username: { $regex: pattern, $options: "i" } },
    ];
  }

  if (unitId) {
    query.unitId = unitId as unknown as IUser["unitId"];
  }

  try {
    // Role scope, applied LAST so it always wins over request filters.
    // A scope that cannot be resolved matches nothing (never everything).
    Object.assign(
      query,
      await usersScopeFilter(user, getUsersScope(user.role))
    );

    const [users, total] = await Promise.all([
      User.find(query)
        .select("name username phone jawatanInfo role jabatanId unitId status createdAt")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    // Manually look up jabatan and unit names (more resilient than populate)
    const jabatanIds = Array.from(new Set(users.map((u) => u.jabatanId?.toString()).filter(Boolean)));
    const unitIds = Array.from(new Set(users.map((u) => u.unitId?.toString()).filter(Boolean)));

    const [jabatans, units] = await Promise.all([
      jabatanIds.length ? Jabatan.find({ _id: { $in: jabatanIds } }).select("name").lean() : [],
      unitIds.length ? Unit.find({ _id: { $in: unitIds } }).select("name").lean() : [],
    ]);

    const jabatanMap = new Map(jabatans.map((j) => [j._id.toString(), j.name]));
    const unitMap = new Map(units.map((u) => [u._id.toString(), u.name]));

    const enrichedUsers = users.map((u) => ({
      ...u,
      jabatanName: (u.jabatanId ? jabatanMap.get(u.jabatanId.toString()) : null) || null,
      unitName: (u.unitId ? unitMap.get(u.unitId.toString()) : null) || null,
    }));

    // Envelope (not a bare array) so `total` is always known and the list
    // can be paged server-side instead of silently capping at 500.
    return success({ users: enrichedUsers, total, page, limit });
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
      jawatanInfo: data.jawatanInfo || undefined,
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