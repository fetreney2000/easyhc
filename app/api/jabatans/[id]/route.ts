import { connectDB } from "@/lib/db/mongoose";
import { getAuthenticatedUser, unauthorized, forbidden, badRequest, serverError, success } from "@/lib/api/utils";
import Jabatan from "@/lib/db/models/Jabatan";
import { can } from "@/lib/auth/rbac";
import { createJabatanSchema } from "@/lib/validation/schemas";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  await connectDB();
  try {
    const jabatan = await Jabatan.findById(params.id).lean();
    if (!jabatan) return badRequest("Jabatan tidak dijumpai");
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
    if (existing) return badRequest("Nama jabatan sudah wujud");
    const jabatan = await Jabatan.findByIdAndUpdate(params.id, { name: validation.data.name }, { new: true });
    if (!jabatan) return badRequest("Jabatan tidak dijumpai");
    return success(jabatan);
  } catch { return serverError(); }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "users:manage")) return forbidden();
  await connectDB();
  try {
    const jabatan = await Jabatan.findByIdAndDelete(params.id);
    if (!jabatan) return badRequest("Jabatan tidak dijumpai");
    return success({ message: "Jabatan berjaya dipadam" });
  } catch { return serverError(); }
}