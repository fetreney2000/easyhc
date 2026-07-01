import { connectDB } from "@/lib/db/mongoose";
import { getAuthenticatedUser, unauthorized, serverError, success, badRequest, forbidden } from "@/lib/api/utils";
import Jabatan from "@/lib/db/models/Jabatan";
import { createJabatanSchema } from "@/lib/validation/schemas";
import { can } from "@/lib/auth/rbac";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  await connectDB();

  try {
    const jabatans = await Jabatan.find().sort({ name: 1 }).lean();
    return success(jabatans);
  } catch (error) {
    console.error("Error fetching jabatans:", error);
    return serverError();
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  if (!can(user.role, "users:manage")) return forbidden();
  await connectDB();

  try {
    const body = await request.json();
    const validation = createJabatanSchema.safeParse(body);
    if (!validation.success) return badRequest(validation.error.errors[0].message);

    const existing = await Jabatan.findOne({ name: validation.data.name });
    if (existing) return badRequest("Nama jabatan sudah wujud");

    const jabatan = await Jabatan.create({ name: validation.data.name });
    return success(jabatan, 201);
  } catch (error) {
    console.error("Error creating jabatan:", error);
    return serverError();
  }
}