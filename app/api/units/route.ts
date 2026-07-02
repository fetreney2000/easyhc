import { connectDB } from "@/lib/db/mongoose";
import { getAuthenticatedUser, unauthorized, serverError, success, badRequest, forbidden } from "@/lib/api/utils";
import Unit from "@/lib/db/models/Unit";
import { createUnitSchema } from "@/lib/validation/schemas";
import { can } from "@/lib/auth/rbac";
import { Types } from "mongoose";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();
  await connectDB();

  const { searchParams } = new URL(request.url);
  const jabatanId = searchParams.get("jabatanId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {};
  if (jabatanId) query.jabatanId = jabatanId;

  try {
    const units = await Unit.find(query)
      .sort({ name: 1 })
      .lean();

    // Manually look up referenced names
    const Jabatan = (await import("@/lib/db/models/Jabatan")).default;
    const Floor = (await import("@/lib/db/models/Floor")).default;

    const jabatanIds = [...new Set(units.map((u) => u.jabatanId?.toString()).filter(Boolean))];
    const floorIds = [...new Set(units.map((u) => u.homeFloorId?.toString()).filter(Boolean))];

    const [jabatans, floors] = await Promise.all([
      jabatanIds.length ? Jabatan.find({ _id: { $in: jabatanIds } }).select("name").lean() : [],
      floorIds.length ? Floor.find({ _id: { $in: floorIds } }).select("name").lean() : [],
    ]);

    const jabatanMap = new Map(jabatans.map((j) => [j._id.toString(), j.name]));
    const floorMap = new Map(floors.map((f) => [f._id.toString(), f.name]));

    const enrichedUnits = units.map((u) => ({
      ...u,
      jabatanName: (u.jabatanId ? jabatanMap.get(u.jabatanId.toString()) : null) || null,
      homeFloorName: (u.homeFloorId ? floorMap.get(u.homeFloorId.toString()) : null) || null,
    }));

    return success(enrichedUnits);
  } catch (error) {
    console.error("Error fetching units:", error);
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
    const validation = createUnitSchema.safeParse(body);
    if (!validation.success) return badRequest(validation.error.errors[0].message);

    const unit = await Unit.create({
      name: validation.data.name,
      jabatanId: new Types.ObjectId(validation.data.jabatanId),
      homeFloorId: validation.data.homeFloorId
        ? new Types.ObjectId(validation.data.homeFloorId)
        : undefined,
    });

    return success(unit, 201);
  } catch (error) {
    console.error("Error creating unit:", error);
    return serverError();
  }
}