import { Role } from "@/lib/db/types";

/**
 * Actions that can be performed in the system.
 * Each action maps to a capability in the permissions matrix (Section 5).
 *
 * Note: row-level visibility is NOT expressed here — it lives in the scope
 * helpers (getAttendanceScope/getReportsScope/getUsersScope/getCheckoutScope/
 * getEvacuationScope) at the bottom of this file. Actions that only duplicated
 * a scope helper (attendance:view_*, users:view_own_unit, profile:edit_own …)
 * were removed so that granting or withholding one always means something.
 */
export type Action =
  | "users:manage"
  | "users:manage_admin" // Can assign admin/superadmin roles
  | "users:view_all"
  | "floors:manage"
  | "floors:view_all"
  | "floors:view_own_floor"
  | "attendance:checkout_all"
  | "attendance:checkout_own_floor"
  | "attendance:checkout_own_unit"
  | "attendance:checkout_department"
  | "attendance:manual_checkin"
  | "reports:generate_all"
  | "reports:generate_own"
  | "reports:generate_own_unit"
  | "reports:generate_own_floor"
  | "reports:generate_department"
  | "locations:track_all"
  | "locations:track_own_unit"
  | "locations:track_department"
  | "evacuation:confirm_own" // Self-confirming "I reached the muster point"
  | "evacuation:confirm_others" // Warden marking someone else (visitors too)
  | "evacuation:start"
  | "evacuation:close"
  | "evacuation:view_report"; // After-action reports of closed sessions

/**
 * RBAC permission check. Single source of truth for all permission logic.
 * Used both server-side (API routes) and client-side (conditional rendering).
 *
 * Implements the permissions matrix from Section 5 of the spec.
 */
export function can(role: Role, action: Action): boolean {
  switch (role) {
    case "superadmin":
      return true; // Superadmin has all permissions

    case "admin":
      // Admin has all except managing admin/superadmin roles
      switch (action) {
        case "users:manage_admin":
          return false;
        default:
          return true;
      }

    case "dept_head":
      switch (action) {
        // Administration is not a department head's job
        case "users:manage":
        case "users:manage_admin":
        case "floors:manage":
        case "attendance:manual_checkin":
          return false;
        // Evacuation sessions are building/floor-wide operations
        case "evacuation:start":
        case "evacuation:close":
        case "evacuation:view_report":
        case "evacuation:confirm_others":
          return false;
        // Department heads see every floor (their department's units span
        // them) — this grant used to ride the old `default: true` branch
        case "floors:view_all":
          return true;
        // Global scope is replaced by department scope
        case "users:view_all":
        case "attendance:checkout_all":
        case "reports:generate_all":
        case "locations:track_all":
          return false;
        // Unit scope belongs to unit_head
        case "attendance:checkout_own_unit":
        case "reports:generate_own_unit":
        case "locations:track_own_unit":
          return false;
        // Floor scope belongs to floor_head — never honour it here either,
        // or can() would contradict getAttendanceScope/getReportsScope
        case "attendance:checkout_own_floor":
        case "reports:generate_own_floor":
          return false;
        // Department scope (jabatan + every unit under it)
        case "attendance:checkout_department":
        case "reports:generate_department":
        case "locations:track_department":
          return true;
        // Everyone confirms their OWN arrival at the assembly point
        case "evacuation:confirm_own":
          return true;
        // DENY by default: a NEW action must be granted here explicitly —
        // the old `default: true` silently handed every future permission
        // to this role (the exact contradiction the file warns about)
        default:
          return false;
      }

    case "unit_head":
      switch (action) {
        case "users:manage":
        case "users:manage_admin":
        case "floors:manage":
        case "attendance:manual_checkin":
        case "floors:view_all":
        case "attendance:checkout_all":
        case "attendance:checkout_department":
        case "reports:generate_all":
        case "reports:generate_department":
        case "locations:track_all":
        case "locations:track_department":
        // Evacuation sessions are building/floor-wide operations
        case "evacuation:start":
        case "evacuation:close":
        case "evacuation:view_report":
        case "evacuation:confirm_others":
          return false;
        // Floor scope belongs to floor_head — never honour it here either,
        // or can() would contradict getAttendanceScope/getReportsScope
        case "attendance:checkout_own_floor":
        case "reports:generate_own_floor":
          return false;
        // Scoped permissions (actual filtering done at query level)
        case "users:view_all":
          return false;
        case "attendance:checkout_own_unit":
        case "reports:generate_own_unit":
        case "locations:track_own_unit":
          return true;
        // floors:view_own_floor is the "may open the floors page" permission
        // (their view_all is false); the unit scope already covers their data
        case "floors:view_own_floor":
          return true;
        // Everyone confirms their OWN arrival at the assembly point
        case "evacuation:confirm_own":
          return true;
        // DENY by default — a NEW action must be granted here explicitly
        // (see the dept_head note above)
        default:
          return false;
      }

    case "floor_head":
      switch (action) {
        case "users:manage":
        case "users:manage_admin":
        case "floors:manage":
        case "attendance:manual_checkin":
        case "users:view_all":
        case "floors:view_all":
        case "attendance:checkout_all":
        case "attendance:checkout_own_unit":
        case "attendance:checkout_department":
        case "reports:generate_all":
        case "reports:generate_own_unit":
        case "reports:generate_department":
        case "locations:track_all":
        case "locations:track_own_unit":
        case "locations:track_department":
          return false;
        // A floor warden may start AND end evacuation mode (only
        // superadmin/admin/floor_head/safety_head activate it) — they still
        // cannot confirm anyone outside their own floor (scope-checked below)
        case "evacuation:start":
        case "evacuation:close":
        case "evacuation:view_report":
        case "attendance:checkout_own_floor":
        case "floors:view_own_floor":
        case "reports:generate_own_floor":
        // …and as the floor's warden they confirm people on their own floor
        case "evacuation:confirm_others":
        // Everyone confirms their OWN arrival at the assembly point
        case "evacuation:confirm_own":
          return true;
        // DENY by default — a NEW action must be granted here explicitly
        // (see the dept_head note above)
        default:
          return false;
      }

    case "safety_head":
      switch (action) {
        // Administration is not theirs
        case "users:manage":
        case "users:manage_admin":
        case "floors:manage":
        case "attendance:manual_checkin":
          return false;
        // Emergency role: full building visibility, and the incident
        // commander can close out stragglers (every force check-out is
        // audited with actor + scope)
        case "attendance:checkout_all":
        case "locations:track_all":
          return true;
        // Scoped variants make no sense for a building-wide role
        case "attendance:checkout_own_floor":
        case "attendance:checkout_own_unit":
        case "attendance:checkout_department":
        case "locations:track_own_unit":
        case "locations:track_department":
          return false;
        default:
          return true;
      }

    case "user":
      switch (action) {
        // The live floor board: everyone can see who is on their own floor
        case "floors:view_own_floor":
          return true;
        // …and their own attendance history (scoped to "own" by
        // getReportsScope — other people's history stays supervisory)
        case "reports:generate_own":
          return true;
        // Everyone reports their own arrival at the assembly point
        case "evacuation:confirm_own":
          return true;
        default:
          return false;
      }

    default:
      return false;
  }
}

/**
 * Query scope for a role — the single source of truth for WHERE a role's
 * data is filtered. Deliberately explicit per role instead of composed from
 * `can()`, because several roles legitimately hold more than one scoped
 * permission (e.g. unit_head holds both unit and floor permissions) and the
 * precedence between them must be unambiguous.
 *
 *  - "all"       → no data filter
 *  - "department"→ jabatan + every unit under it
 *  - "own_unit"  → members of the actor's unit (+ its home floor)
 *  - "own_floor" → the actor's unit home floor
 *  - "own"       → the actor's own records only
 *  - "own_and_floor" → own records PLUS everything on the unit's home floor
 *  - "none"      → no access at all
 */
export type Scope =
  | "all"
  | "department"
  | "own_unit"
  | "own_floor"
  | "own"
  | "own_and_floor"
  | "none";

export function getAttendanceScope(role: Role): Scope {
  switch (role) {
    case "superadmin":
    case "admin":
    case "safety_head":
      return "all";
    case "dept_head":
      return "department";
    case "unit_head":
      return "own_unit";
    case "floor_head":
      return "own_floor";
    case "user":
      // The muster board is the point of the app: an employee sees their own
      // record PLUS everyone on their unit's home floor (and visitors there).
      // Falls back to "own" when no home floor is configured.
      return "own_and_floor";
    default:
      return "own";
  }
}

export function getReportsScope(role: Role): Scope {
  switch (role) {
    case "superadmin":
    case "admin":
    case "safety_head":
      return "all";
    case "dept_head":
      return "department";
    case "unit_head":
      return "own_unit";
    case "floor_head":
      return "own_floor";
    case "user":
      // Employees get their OWN history (there is no other view of it) —
      // other people's presence history stays supervisory
      return "own";
    default:
      return "none";
  }
}

/**
 * The directory is deliberately NOT floor-scoped: a floor has no static
 * membership (who is standing on it comes from attendance, which the floor
 * board already shows), so floor_head gets their own record only.
 */
export function getUsersScope(role: Role): Scope {
  switch (role) {
    case "superadmin":
    case "admin":
    case "safety_head":
      return "all";
    case "dept_head":
      return "department";
    case "unit_head":
      return "own_unit";
    default:
      return "own";
  }
}

/**
 * Check if a role can force-checkout on a specific floor scope.
 * Returns the scope: "all", "department", "own_unit", "own_floor", or "none"
 */
export function getCheckoutScope(
  role: Role
): "all" | "department" | "own_unit" | "own_floor" | "none" {
  switch (role) {
    case "superadmin":
    case "admin":
    // The incident commander closes out stragglers building-wide (audited)
    case "safety_head":
      return "all";
    case "dept_head":
      return "department";
    case "unit_head":
      return "own_unit";
    case "floor_head":
      return "own_floor";
    default:
      return "none";
  }
}

/**
 * Evacuation roster visibility / who may confirm OTHERS (self-confirmation
 * is separate: evacuation:confirm_own, granted to everyone).
 *
 * Four roles may activate (start/close) evacuation mode: superadmin, admin,
 * floor_head, safety_head. Name visibility mirrors the warden structure:
 * safety/admin see the building, a floor head sees (and confirms) their own
 * floor, everybody else gets counts, their own status and location stats for
 * the floors they belong to.
 */
export function getEvacuationScope(
  role: Role
): "all" | "own_floor" | "none" {
  switch (role) {
    case "superadmin":
    case "admin":
    case "safety_head":
      return "all";
    case "floor_head":
      return "own_floor";
    default:
      return "none";
  }
}