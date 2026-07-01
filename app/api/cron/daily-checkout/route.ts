import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import Attendance from "@/lib/db/models/Attendance";

/**
 * Vercel Cron: Daily auto-checkout at 3:00 AM MYT (UTC+8).
 * Force-closes every open Attendance record.
 * Idempotent and safe to re-run.
 *
 * Vercel cron expression: 0 3 * * * (but since Vercel uses UTC,
 * and MYT is UTC+8, we need 19:00 UTC = 03:00 MYT)
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  try {
    const result = await Attendance.updateMany(
      {
        checkedOutAt: null,
      },
      {
        $set: {
          checkedOutAt: new Date(),
          checkedOutBy: "cron_daily",
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: `Auto-checkout completed. ${result.modifiedCount} records closed.`,
      modifiedCount: result.modifiedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in daily checkout cron:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}