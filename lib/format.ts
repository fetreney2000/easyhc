import { strings } from "@/lib/i18n/strings";

/**
 * Short local clock label, e.g. "10:34". Timestamps are stored as UTC
 * (ISO 8601) and rendered as SITE time (Asia/Kuala_Lumpur — the app, its
 * cron schedule and its workforce are all Malaysian). Pinning the zone in
 * the formatter means server (UTC build containers) and client render the
 * IDENTICAL string, so there is no hydration mismatch to suppress — and it
 * survives without the TZ env var, which Vercel refuses to configure.
 * Returns "—" for missing/malformed input rather than React's English
 * "Invalid Date" (an i18n violation and visible junk).
 */
export const clock = (iso: string): string => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleTimeString("ms-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });
};

/**
 * Human duration between two ISO timestamps: "48 min", "1 jam 5 min".
 * Used by the evacuation after-action report.
 */
export function duration(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes === 0) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} jam ${rest} min` : `${hours} jam`;
}

/**
 * Relative freshness for the dashboard's activity feed ("Baru sahaja",
 * "3 minit lalu"), falling back to the clock time for anything older than
 * an hour. Recomputed on each poll — no 1s timer needed.
 */
export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return clock(iso);
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return strings.justNow;
  if (minutes < 60) return strings.minutesAgo(minutes);
  return clock(iso);
}

/**
 * Stable per-floor identity colour (hue hashed from the id): works for any
 * number of floors, survives renames, and means "Aras 2 is teal" everywhere
 * it appears — dashboard strip, floor cards, the evacuation display.
 */
export const floorColor = (floorId: string): string => {
  let hash = 0;
  for (let i = 0; i < floorId.length; i++) {
    hash = (hash * 31 + floorId.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 62%, 45%)`;
};
