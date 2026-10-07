import { connectDB } from "@/lib/db/mongoose";
import { success, serverError } from "@/lib/api/utils";
import Evacuation from "@/lib/db/models/Evacuation";

// The whole point of this route is a LIVE boolean — it must never be
// prerendered. Without this export Next 14 treats a GET handler that takes
// no Request and touches no dynamic API as STATIC (the build log shows "○"),
// freezing {"active": false} at build time so the visitor-facing "Saya
// Selamat" button could never appear after a deploy.
export const dynamic = "force-dynamic";

/**
 * GET /api/evacuation/status — PUBLIC.
 *
 * One boolean ("is evacuation mode running?") so the visitor-facing check-in
 * page (/visitor/[floorId]) can offer its "Saya Selamat" button without any
 * credentials. Deliberately exposes nothing else: no counts, no names, no
 * times. Not rate-limited — it is a single indexed lookup that tells an
 * unauthenticated caller only whether an alarm is live (which the button on
 * their own screen already reveals).
 */
export async function GET() {
  try {
    await connectDB();
    const active = await Evacuation.findOne({ status: "active" })
      .select("_id")
      .lean();
    return success({ active: !!active });
  } catch (error) {
    console.error("Error reading evacuation status:", error);
    return serverError();
  }
}
