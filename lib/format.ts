/**
 * Short local clock label, e.g. "10:34". Timestamps are stored as UTC
 * (ISO 8601) and rendered in the viewer's own timezone. Returns "—" for
 * missing/malformed input — React's fallback would be the English
 * "Invalid Date" (an i18n violation and visible junk).
 */
export const clock = (iso: string): string => {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleTimeString("ms-MY", {
    hour: "2-digit",
    minute: "2-digit",
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
