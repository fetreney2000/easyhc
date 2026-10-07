import { Types } from "mongoose";
import User from "@/lib/db/models/User";
import Unit from "@/lib/db/models/Unit";
import Floor from "@/lib/db/models/Floor";
import Attendance from "@/lib/db/models/Attendance";
import { getEvacuationScope } from "@/lib/auth/rbac";
import { unitMembership } from "@/lib/auth/scope";
import type { AuthUser } from "@/lib/api/utils";
import type { IEvacuation, IRosterEntry } from "@/lib/db/types";
import { strings } from "@/lib/i18n/strings";

/**
 * Server-side helpers shared by /api/evacuation and /api/evacuation/confirm:
 * roster snapshot, counts, the light (roster-free) projection the sticky bar
 * polls every 10s, and per-role roster visibility.
 *
 * Confirms are written with atomic positional updates (see the routes) — a
 * full document save would let two simultaneous "saya selamat" taps at a
 * crowded muster point overwrite each other.
 */

export interface EvacCounts {
  total: number;
  confirmed: number;
  missing: number;
}

export interface EvacRosterRow {
  _id: string;
  name: string;
  type: "employee" | "visitor";
  floorId: string | null;
  floorName: string | null;
  confirmedAt: string | null;
}

export interface EvacuationLight {
  _id: string;
  status: "active" | "closed";
  startedAt: string;
  startedByName: string;
  counts: EvacCounts;
  mine: { inRoster: boolean; confirmedAt: string | null };
  /** Present only when the roster was requested AND is visible to the caller. */
  rosterVisible?: boolean;
  roster?: EvacRosterRow[];
}

export interface EvacuationLastClosed {
  startedAt: string;
  closedAt: string;
  counts: EvacCounts;
}

export interface EvacuationResponse {
  session: EvacuationLight | null;
  lastClosed?: EvacuationLastClosed | null;
}

export function countsFor(
  roster: Array<{ confirmedAt?: Date | null }>
): EvacCounts {
  const confirmed = roster.filter((entry) => entry.confirmedAt).length;
  return {
    total: roster.length,
    confirmed,
    missing: roster.length - confirmed,
  };
}

export function lightSession(
  session: IEvacuation,
  userId: string
): EvacuationLight {
  const mine = session.roster.find((entry) => entry.userId?.toString() === userId);
  return {
    _id: session._id.toString(),
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    startedByName: session.startedByName,
    counts: countsFor(session.roster),
    mine: {
      inRoster: !!mine,
      confirmedAt: mine?.confirmedAt?.toISOString() ?? null,
    },
  };
}

function toRow(entry: IRosterEntry): EvacRosterRow {
  return {
    _id: entry._id.toString(),
    name: entry.name,
    type: entry.type,
    floorId: entry.floorId?.toString() ?? null,
    floorName: entry.floorName ?? null,
    confirmedAt: entry.confirmedAt?.toISOString() ?? null,
  };
}

/**
 * Who may see names: safety/admin see the whole roster, a floor head sees
 * (and may confirm) their own floor, everyone else gets counts only — no
 * names. Fail closed: an unresolvable floor scope yields NO roster.
 */
export async function visibleRoster(
  session: IEvacuation,
  user: AuthUser
): Promise<{ canSee: boolean; rows: EvacRosterRow[] }> {
  const scope = getEvacuationScope(user.role);
  if (scope === "none") return { canSee: false, rows: [] };

  let allowedFloorIds: Set<string> | null = null; // null = every floor
  if (scope === "own_floor") {
    const membership = await unitMembership(user.unitId);
    allowedFloorIds = new Set(
      membership?.homeFloorIds.map((floor) => floor.toString()) ?? []
    );
    if (allowedFloorIds.size === 0) return { canSee: false, rows: [] };
  }

  const rows = session.roster
    .filter(
      (entry) =>
        !allowedFloorIds ||
        (entry.floorId && allowedFloorIds.has(entry.floorId.toString()))
    )
    .map(toRow);

  return { canSee: true, rows };
}

/**
 * The roster SNAPSHOT taken when the session starts: every active employee
 * (floor resolved through their unit's home floor) plus every visitor with
 * an open check-in. Names are copied in so the API never needs a populate.
 */
export async function buildRoster(): Promise<IRosterEntry[]> {
  const [users, units, floors, visitors] = await Promise.all([
    User.find({ status: "active" }).select("name unitId").lean(),
    Unit.find({}).select("homeFloorId").lean(),
    Floor.find({}).select("name").lean(),
    Attendance.find({ type: "visitor", checkedOutAt: null })
      .select("visitorName floorId")
      .lean(),
  ]);

  const floorName = new Map(floors.map((floor) => [floor._id.toString(), floor.name]));
  const unitFloor = new Map(
    units
      .filter((unit) => unit.homeFloorId)
      .map((unit) => [unit._id.toString(), unit.homeFloorId])
  );

  const employees: IRosterEntry[] = users.map((account) => {
    const floorId = account.unitId
      ? unitFloor.get(account.unitId.toString())
      : undefined;
    return {
      _id: new Types.ObjectId(),
      userId: account._id,
      name: account.name,
      type: "employee",
      floorId,
      floorName: floorId ? floorName.get(floorId.toString()) : undefined,
    };
  });

  const visitorRows: IRosterEntry[] = visitors.map((record) => ({
    _id: new Types.ObjectId(),
    visitorAttendanceId: record._id,
    name: record.visitorName?.trim() || strings.visitor,
    type: "visitor",
    floorId: record.floorId,
    floorName: floorName.get(record.floorId.toString()),
  }));

  // Employees first, each group alphabetical — a warden scans one list
  return [...employees, ...visitorRows].sort((a, b) =>
    a.type === b.type
      ? a.name.localeCompare(b.name)
      : a.type === "employee"
        ? -1
        : 1
  );
}
