/**
 * Short local clock label, e.g. "10:34". Timestamps are stored as UTC
 * (ISO 8601) and rendered in the viewer's own timezone.
 */
export const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString("ms-MY", {
    hour: "2-digit",
    minute: "2-digit",
  });
