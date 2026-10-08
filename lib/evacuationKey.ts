/**
 * Canonical SWR key for the takeover: session + scoped roster (everything
 * the full-screen display renders). Deliberately WITHOUT `closed=1` — the
 * last-closed summary rides its own slow poll, because the layout would
 * otherwise fetch a closed session's data on every SSR and every tick
 * forever.
 *
 * Lives in its own dependency-free module because CLIENT components import
 * it: importing the value from lib/evacuation.ts would drag every Mongoose
 * model into the browser bundle (that file imports them for real).
 */
export const EVACUATION_KEY = "/api/evacuation?roster=1";

/** Last-closed summary for the /evacuation one-liner (roles without the
 *  history table below). */
export const EVACUATION_LAST_CLOSED_KEY = "/api/evacuation?closed=1";

/** Public boolean status polled by the visitor-facing check-in page. */
export const EVACUATION_STATUS_KEY = "/api/evacuation/status";

/** After-action report list (evacuation:view_report roles only). */
export const EVACUATION_HISTORY_KEY = "/api/evacuation?history=1";
