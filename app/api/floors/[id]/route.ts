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
import { updateFloorSchema } from "@/lib/validation/schemas";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  await connectDB();

  try {
    const floor = await Floor.findById(params.id).lean();
    if (!floor) return badRequest("Lantai tidak dijumpai");
    return success(floor);
  } catch (error) {
    console.error("Error fetching floor:", error);
    return serverError();
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "floors:manage")) return forbidden();

  await connectDB();

  try {
    const body = await request.json();
    const validation = updateFloorSchema.safeParse(body);
    if (!validation.success) {
      return badRequest(validation.error.errors[0].message);
    }

    const floor = await Floor.findById(params.id);
    if (!floor) return badRequest("Lantai tidak dijumpai");

    // Check duplicate name
    const existing = await Floor.findOne({
      name: validation.data.name,
      _id: { $ne: params.id },
    });
    if (existing) return badRequest("Nama lantai sudah wujud");

    floor.name = validation.data.name;
    await floor.save();

    return success(floor);
  } catch (error) {
    console.error("Error updating floor:", error);
    return serverError();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "floors:manage")) return forbidden();

  await connectDB();

  try {
    const floor = await Floor.findByIdAndDelete(params.id);
    if (!floor) return badRequest("Lantai tidak dijumpai");
    return success({ message: "Lantai berjaya dipadam" });
  } catch (error) {
    console.error("Error deleting floor:", error);
    return serverError();
  }
}

// Regenerate QR token
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "floors:manage")) return forbidden();

  await connectDB();

  try {
    const floor = await Floor.findById(params.id);
    if (!floor) return badRequest("Lantai tidak dijumpai");

    floor.qrToken = crypto.randomUUID();
    await floor.save();

    return success(floor);
  } catch (error) {
    console.error("Error regenerating QR:", error);
    return serverError();
  }
}