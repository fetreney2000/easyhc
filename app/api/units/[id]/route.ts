import { connectDB } from "@/lib/db/mongoose";
import { Types } from "mongoose";
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, success } from "@/lib/api/utils";
import Unit from "@/lib/db/models/Unit";
import { can } from "@/lib/auth/rbac";
import { createUnitSchema } from "@/lib/validation/schemas";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  await connectDB();
  try {
    const unit = await Unit.findById(params.id).populate("jabatanId", "name").populate("homeFloorId", "name").lean();
    if (!unit) return badRequest("Unit tidak dijumpai");
    return success(unit);
  } catch { return serverError(); }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "users:manage")) return forbidden();
  await connectDB();
  try {
    const body = await request.json();
    const validation = createUnitSchema.safeParse(body);
    if (!validation.success) return badRequest(validation.error.errors[0].message);
    const unit = await Unit.findByIdAndUpdate(params.id, {
      name: validation.data.name,
      jabatanId: new Types.ObjectId(validation.data.jabatanId),
      homeFloorId: validation.data.homeFloorId ? new Types.ObjectId(validation.data.homeFloorId) : undefined,
    }, { new: true });
    if (!unit) return badRequest("Unit tidak dijumpai");
    return success(unit);
  } catch { return serverError(); }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "users:manage")) return forbidden();
  await connectDB();
  try {
    const unit = await Unit.findByIdAndDelete(params.id);
    if (!unit) return badRequest("Unit tidak dijumpai");
    return success({ message: "Unit berjaya dipadam" });
  } catch { return serverError(); }
}