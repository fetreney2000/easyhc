/**
 * Canonical SWR key for the evacuation session (roster + last-closed).
 *
 * Lives in its own dependency-free module because CLIENT components import
 * it: importing the value from lib/evacuation.ts would drag every Mongoose
 * model into the browser bundle (that file imports them for real).
 */
export const EVACUATION_KEY = "/api/evacuation?roster=1&closed=1";

/** Public boolean status polled by the visitor-facing check-in page. */
export const EVACUATION_STATUS_KEY = "/api/evacuation/status";
