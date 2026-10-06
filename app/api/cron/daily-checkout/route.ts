import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { bearerToken, secureCompare } from "@/lib/api/utils";
import Attendance from "@/lib/db/models/Attendance";

/**
 * Vercel Cron: daily maintenance at 3:00 AM MYT (UTC+8).
 *   1. Force-closes every open Attendance record (auto-checkout).
 *   2. Purges Attendance records older than the retention window.
 *
 * Vercel cron expression: 0 19 * * * (19:00 UTC = 03:00 MYT)
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 * Idempotent and safe to re-run.
 */

/** Days of attendance history to keep (default 1 year). */
const DEFAULT_RETENTION_DAYS = 365;

function retentionDays(): number {
  const raw = process.env.ATTENDANCE_RETENTION_DAYS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
}

export async function GET(request: Request) {
  // Verify cron secret — fail CLOSED when CRON_SECRET is not configured
  const cronSecret = process.env.CRON_SECRET;
  const provided = bearerToken(request);

  if (!secureCompare(provided, cronSecret)) {
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

    // Retention: keeps the M0 bucket from growing without bound while still
    // preserving more than a year of muster history (README risk table).
    const days = retentionDays();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const purge = await Attendance.deleteMany({ checkedInAt: { $lt: cutoff } });

    return NextResponse.json({
      success: true,
      message: `Auto-checkout completed. ${result.modifiedCount} records closed, ${purge.deletedCount} purged (retention ${days} days).`,
      modifiedCount: result.modifiedCount,
      purgedCount: purge.deletedCount,
      retentionDays: days,
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
