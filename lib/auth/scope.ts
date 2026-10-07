import { Types } from "mongoose";
import User from "@/lib/db/models/User";
import Unit from "@/lib/db/models/Unit";
import { Role } from "@/lib/db/types";
import { Scope, getCheckoutScope } from "@/lib/auth/rbac";

/**
 * Query scoping shared by the attendance / reports / users / checkout routes.
 *
 * Every function here FAILS CLOSED: a role whose scope cannot be resolved
 * (missing unitId, missing jabatanId, missing home floor, malformed id)
 * gets a filter that matches nothing instead of an unscoped query.
 *
 * A "department" (jabatan) contains:
 *   - users assigned directly to it (User.jabatanId), plus
 *   - users in every Unit that belongs to it (Unit.jabatanId)
 * Department presence additionally covers visitors on those units' home floors.
 */

export interface ScopeActor {
  id: string;
  role: Role;
  unitId?: string;
  jabatanId?: string;
}

export interface Membership {
  memberIds: Types.ObjectId[];
  homeFloorIds: Types.ObjectId[];
}

/** A filter that can never match a document. */
const NO_MATCH = { _id: { $in: [] as Types.ObjectId[] } };

function isId(value?: string | null): value is string {
  return !!value && Types.ObjectId.isValid(value);
}

export async function unitMembership(unitId?: string): Promise<Membership | null> {
  if (!isId(unitId)) return null;

  const [unit, members] = await Promise.all([
    Unit.findById(unitId).select("homeFloorId").lean(),
    User.find({ unitId }).select("_id").lean(),
  ]);

  return {
    memberIds: members.map((m) => m._id),
    homeFloorIds: unit?.homeFloorId ? [unit.homeFloorId] : [],
  };
}

export async function departmentMembership(
  jabatanId?: string
): Promise<Membership | null> {
  if (!isId(jabatanId)) return null;

  const units = await Unit.find({ jabatanId }).select("homeFloorId").lean();
  const unitIds = units.map((u) => u._id);

  const members = await User.find({
    $or: [{ jabatanId }, { unitId: { $in: unitIds } }],
  })
    .select("_id")
    .lean();

  return {
    memberIds: members.map((m) => m._id),
    homeFloorIds: units
      .map((u) => u.homeFloorId)
      .filter((f): f is Types.ObjectId => !!f),
  };
}

/**
 * Build the Mongo filter that limits a scoped query, or null when the scope
 * grants no access at all ("none" / unresolvable scope).
 */
export async function scopeFilter(
  actor: ScopeActor,
  scope: Scope
): Promise<Record<string, unknown> | null> {
  switch (scope) {
    case "all":
      return {};

    case "none":
      return null;

    case "own":
      return isId(actor.id) ? { userId: new Types.ObjectId(actor.id) } : NO_MATCH;

    case "own_and_floor": {
      // Muster board for a plain employee: their own record (always, even
      // with no unit configured) PLUS everyone present on their unit's home
      // floor — visitors included. Fails safe to "own", never to "everything".
      const own = isId(actor.id)
        ? { userId: new Types.ObjectId(actor.id) }
        : NO_MATCH;

      const membership = await unitMembership(actor.unitId);
      if (!membership?.homeFloorIds.length) {
        return { $or: [own] };
      }

      return {
        $or: [own, { floorId: { $in: membership.homeFloorIds } }],
      };
    }

    case "own_unit": {
      const membership = await unitMembership(actor.unitId);
      if (!membership) return null;

      const or: Record<string, unknown>[] = [
        { userId: { $in: membership.memberIds } },
      ];
      if (membership.homeFloorIds.length) {
        // Unit heads also see visitors on their unit's home floor
        or.push({ type: "visitor", floorId: { $in: membership.homeFloorIds } });
      }
      return { $or: or };
    }

    case "department": {
      const membership = await departmentMembership(actor.jabatanId);
      if (!membership) return null;

      const or: Record<string, unknown>[] = [
        { userId: { $in: membership.memberIds } },
      ];
      if (membership.homeFloorIds.length) {
        or.push({ type: "visitor", floorId: { $in: membership.homeFloorIds } });
      }
      return { $or: or };
    }

    case "own_floor": {
      const membership = await unitMembership(actor.unitId);
      const homeFloorId = membership?.homeFloorIds[0];
      // No home floor configured → the floor scope cannot be resolved → no data
      return homeFloorId ? { floorId: homeFloorId } : null;
    }

    default:
      return null;
  }
}

/**
 * Users listing scope. Simpler than attendance scope (no visitors/floors).
 */
export async function usersScopeFilter(
  actor: ScopeActor,
  scope: Scope
): Promise<Record<string, unknown>> {
  if (scope === "all") return {};

  if (scope === "department") {
    const membership = await departmentMembership(actor.jabatanId);
    return membership ? { _id: { $in: membership.memberIds } } : NO_MATCH;
  }

  if (scope === "own_unit") {
    return isId(actor.unitId)
      ? { unitId: new Types.ObjectId(actor.unitId) }
      : NO_MATCH;
  }

  if (scope === "none") return NO_MATCH;

  // "own" (and anything unexpected)
  return isId(actor.id) ? { _id: new Types.ObjectId(actor.id) } : NO_MATCH;
}

/**
 * Force-checkout authorisation for a specific attendance record.
 * Scope comes from getCheckoutScope(), membership from this module, so a
 * unit/dept/floor head can only force-checkout inside their own boundary.
 */
export async function canForceCheckoutRecord(
  actor: ScopeActor,
  record: { type: "employee" | "visitor"; userId?: unknown; floorId: unknown }
): Promise<boolean> {
  const scope = getCheckoutScope(actor.role);

  if (scope === "all") return true;
  if (scope === "none") return false;

  const recordFloorId = record.floorId?.toString();

  if (scope === "own_floor") {
    const membership = await unitMembership(actor.unitId);
    return (
      !!recordFloorId &&
      !!membership &&
      membership.homeFloorIds.some((f) => f.toString() === recordFloorId)
    );
  }

  const membership =
    scope === "department"
      ? await departmentMembership(actor.jabatanId)
      : await unitMembership(actor.unitId);
  if (!membership) return false;

  if (record.type === "employee") {
    const recordUserId = record.userId?.toString();
    return (
      !!recordUserId &&
      membership.memberIds.some((id) => id.toString() === recordUserId)
    );
  }

  // Visitors belong to a floor: only on a floor that is a home floor of
  // this unit / of a unit in this department.
  return (
    !!recordFloorId &&
    membership.homeFloorIds.some((f) => f.toString() === recordFloorId)
  );
}
