import { Role } from "@/lib/db/types";

/**
 * Actions that can be performed in the system.
 * Each action maps to a capability in the permissions matrix (Section 5).
 */
export type Action =
  | "users:manage"
  | "users:manage_admin" // Can assign admin/superadmin roles
  | "users:view_all"
  | "users:view_own_unit"
  | "users:view_department"
  | "users:view_own"
  | "floors:manage"
  | "floors:view_all"
  | "floors:view_own_floor"
  | "attendance:checkout_all"
  | "attendance:checkout_own_floor"
  | "attendance:checkout_own_unit"
  | "attendance:checkout_department"
  | "attendance:manual_checkin"
  | "attendance:view_all"
  | "attendance:view_own_floor"
  | "attendance:view_own_unit"
  | "attendance:view_own"
  | "attendance:view_department"
  | "reports:generate_all"
  | "reports:generate_own_unit"
  | "reports:generate_own_floor"
  | "reports:generate_department"
  | "locations:track_all"
  | "locations:track_own_unit"
  | "locations:track_department"
  | "profile:edit_own";

/**
 * RBAC permission check. Single source of truth for all permission logic.
 * Used both server-side (API routes) and client-side (conditional rendering).
 *
 * Implements the permissions matrix from Section 5 of the spec.
 */
export function can(role: Role, action: Action, context?: {
  floorId?: string;
  userId?: string;
  unitId?: string;
  jabatanId?: string;
}): boolean {
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
        // Global scope is replaced by department scope
        case "users:view_all":
        case "attendance:view_all":
        case "attendance:checkout_all":
        case "reports:generate_all":
        case "locations:track_all":
          return false;
        // Unit scope belongs to unit_head
        case "users:view_own_unit":
        case "attendance:view_own_unit":
        case "attendance:checkout_own_unit":
        case "reports:generate_own_unit":
        case "locations:track_own_unit":
          return false;
        // Floor scope belongs to floor_head
        case "attendance:view_own_floor":
        case "attendance:checkout_own_floor":
        case "reports:generate_own_floor":
          return false;
        // Department scope (jabatan + every unit under it)
        case "users:view_department":
        case "attendance:view_department":
        case "attendance:checkout_department":
        case "reports:generate_department":
        case "locations:track_department":
          return true;
        // Everything else (own profile, floor metadata, own data) stays open
        default:
          return true;
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
        case "attendance:view_all":
        case "attendance:view_department":
        case "reports:generate_all":
        case "reports:generate_department":
        case "locations:track_all":
        case "locations:track_department":
          return false;
        // Scoped permissions (actual filtering done at query level)
        case "users:view_all":
        case "users:view_department":
          return false;
        case "users:view_own_unit":
        case "attendance:view_own_unit":
        case "attendance:checkout_own_unit":
        case "reports:generate_own_unit":
        case "locations:track_own_unit":
          return true;
        case "attendance:checkout_own_floor":
        case "attendance:view_own_floor":
        case "floors:view_own_floor":
        case "reports:generate_own_floor":
          return true;
        default:
          return true;
      }

    case "floor_head":
      switch (action) {
        case "users:manage":
        case "users:manage_admin":
        case "floors:manage":
        case "attendance:manual_checkin":
        case "users:view_all":
        case "users:view_own_unit":
        case "users:view_department":
        case "floors:view_all":
        case "attendance:checkout_all":
        case "attendance:checkout_own_unit":
        case "attendance:checkout_department":
        case "attendance:view_all":
        case "attendance:view_own_unit":
        case "attendance:view_department":
        case "reports:generate_all":
        case "reports:generate_own_unit":
        case "reports:generate_department":
        case "locations:track_all":
        case "locations:track_own_unit":
        case "locations:track_department":
          return false;
        case "attendance:checkout_own_floor":
        case "attendance:view_own_floor":
        case "floors:view_own_floor":
        case "reports:generate_own_floor":
          return true;
        default:
          return true;
      }

    case "safety_head":
      switch (action) {
        case "users:manage":
        case "users:manage_admin":
        case "floors:manage":
        case "attendance:manual_checkin":
        case "attendance:checkout_all":
        case "attendance:checkout_own_floor":
        case "attendance:checkout_own_unit":
        case "attendance:checkout_department":
        case "locations:track_all":
        case "locations:track_own_unit":
        case "locations:track_department":
          return false;
        default:
          return true;
      }

    case "user":
      switch (action) {
        case "profile:edit_own":
        case "attendance:view_own":
          return true;
        default:
          return false;
      }

    default:
      return false;
  }
}

/**
 * Get all roles that have a specific permission.
 * Useful for conditional UI rendering.
 */
export function getRolesWithPermission(action: Action): Role[] {
  const allRoles: Role[] = [
    "superadmin",
    "admin",
    "dept_head",
    "unit_head",
    "floor_head",
    "safety_head",
    "user",
  ];
  return allRoles.filter((role) => can(role, action));
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
 *  - "none"      → no access at all
 */
export type Scope = "all" | "department" | "own_unit" | "own_floor" | "own" | "none";

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
    default:
      return "none";
  }
}

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
export function getCheckoutScope(role: Role): "all" | "department" | "own_unit" | "own_floor" | "none" {
  switch (role) {
    case "superadmin":
    case "admin":
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