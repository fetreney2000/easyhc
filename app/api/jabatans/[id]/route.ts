import { connectDB } from "@/lib/db/mongoose";
import { strings } from "@/lib/i18n/strings";
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, success } from "@/lib/api/utils";
import Jabatan from "@/lib/db/models/Jabatan";
import Unit from "@/lib/db/models/Unit";
import User from "@/lib/db/models/User";
import { can } from "@/lib/auth/rbac";
import { createJabatanSchema } from "@/lib/validation/schemas";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  await connectDB();
  try {
    const jabatan = await Jabatan.findById(params.id).lean();
    if (!jabatan) return badRequest(strings.jabatanNotFound);
    return success(jabatan);
  } catch { return serverError(); }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "users:manage")) return forbidden();
  await connectDB();
  try {
    const body = await request.json();
    const validation = createJabatanSchema.safeParse(body);
    if (!validation.success) return badRequest(validation.error.errors[0].message);
    const existing = await Jabatan.findOne({ name: validation.data.name, _id: { $ne: params.id } });
    if (existing) return badRequest(strings.jabatanExists);
    const jabatan = await Jabatan.findByIdAndUpdate(params.id, { name: validation.data.name }, { new: true });
    if (!jabatan) return badRequest(strings.jabatanNotFound);
    return success(jabatan);
  } catch { return serverError(); }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "users:manage")) return forbidden();
  await connectDB();
  try {
    // Don't orphan units or users that still point at this department
    const [unitCount, userCount] = await Promise.all([
      Unit.countDocuments({ jabatanId: params.id }),
      User.countDocuments({ jabatanId: params.id }),
    ]);
    if (unitCount > 0 || userCount > 0) {
      return badRequest(
        `Jabatan ini masih dirujuk oleh ${unitCount} unit dan ${userCount} pengguna. Alihkan mereka terlebih dahulu.`
      );
    }

    const jabatan = await Jabatan.findByIdAndDelete(params.id);
    if (!jabatan) return badRequest(strings.jabatanNotFound);
    return success({ message: strings.jabatanDeleted });
  } catch (error) {
    console.error("Error deleting jabatan:", error);
    return serverError();
  }
}