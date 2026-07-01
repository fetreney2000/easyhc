import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import {
  getAuthenticatedUser,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  success,
} from "@/lib/api/utils";
import Floor from "@/lib/db/models/Floor";
import { can } from "@/lib/auth/rbac";
import { createFloorSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  await connectDB();

  try {
    const floors = await Floor.find()
      .select("name qrToken createdBy createdAt")
      .sort({ name: 1 })
      .lean();

    return success(floors);
  } catch (error) {
    console.error("Error fetching floors:", error);
    return serverError();
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorized();
  }

  if (!can(user.role, "floors:manage")) {
    return forbidden();
  }

  await connectDB();

  try {
    const body = await request.json();
    const validation = createFloorSchema.safeParse(body);

    if (!validation.success) {
      return badRequest(validation.error.errors[0].message);
    }

    const { name } = validation.data;

    // Check for duplicate name
    const existing = await Floor.findOne({ name });
    if (existing) {
      return badRequest("Nama lantai sudah wujud");
    }

    const floor = await Floor.create({
      name,
      createdBy: user.id,
    });

    return success(floor, 201);
  } catch (error) {
    console.error("Error creating floor:", error);
    return serverError();
  }
}