import { Types } from "mongoose";
import User from "@/lib/db/models/User";
import Unit from "@/lib/db/models/Unit";
import Floor from "@/lib/db/models/Floor";
import Attendance from "@/lib/db/models/Attendance";
import Evacuation from "@/lib/db/models/Evacuation";
import { getEvacuationScope, can, type Scope } from "@/lib/auth/rbac";
import { unitMembership, departmentMembership } from "@/lib/auth/scope";
import type { AuthUser } from "@/lib/api/utils";
import type { IEvacuation, IRosterEntry } from "@/lib/db/types";
import { strings } from "@/lib/i18n/strings";

/**
 * Server-side helpers shared by /api/evacuation, its public status/confirm
 * endpoints, and the server layout's initial payload: roster snapshot,
 * counts, per-floor location stats scoped to the caller, the light projection
 * behind the full-screen display, and per-role roster visibility.
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

/** Where expected people are, for the floors a role may see. */
export interface EvacFloorStat {
  floorId: string;
  name: string;
  expected: number;
  confirmed: number;
  missing: number;
}

export interface EvacuationLight {
  _id: string;
  status: "active" | "closed";
  startedAt: string;
  closedAt?: string;
  startedByName: string;
  counts: EvacCounts;
  mine: { inRoster: boolean; confirmedAt: string | null };
  /** Scoped floor location stats (present whenever a session is returned
   *  with ?roster=1 — the full-screen display's key). */
  floors?: EvacFloorStat[];
  /** Present only when names are visible to the caller. */
  rosterVisible?: boolean;
  roster?: EvacRosterRow[];
}

/** One row of the after-action report list (roster never leaves the server). */
export interface EvacuationSummary {
  _id: string;
  startedAt: string;
  closedAt: string;
  startedByName: string;
  counts: EvacCounts;
}

export interface EvacuationLastClosed {
  startedAt: string;
  closedAt: string;
  counts: EvacCounts;
}

export interface EvacuationResponse {
  session: EvacuationLight | null;
  lastClosed?: EvacuationLastClosed | null;
  /** Closed sessions, newest first — only for evacuation:view_report. */
  history?: EvacuationSummary[];
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
    closedAt: session.closedAt?.toISOString(),
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
 * Floors this role may see location stats for — null = every floor.
 * Fail closed: an unresolvable scope yields an EMPTY set (headline counts
 * still show, but no floor locations), never everything.
 */
async function accessibleFloorIds(
  user: AuthUser,
  scope: Scope
): Promise<Set<string> | null> {
  if (scope === "all") return null;

  if (scope === "own_floor") {
    const membership = await unitMembership(user.unitId);
    return new Set(
      membership?.homeFloorIds.map((floor) => floor.toString()) ?? []
    );
  }

  // Not a warden — they still get "where is MY part of the building":
  // department heads their jabatan's floors, everyone else their unit's
  if (user.role === "dept_head") {
    const membership = await departmentMembership(user.jabatanId);
    return new Set(
      membership?.homeFloorIds.map((floor) => floor.toString()) ?? []
    );
  }

  const membership = await unitMembership(user.unitId);
  return new Set(
    membership?.homeFloorIds.map((floor) => floor.toString()) ?? []
  );
}

export interface SessionView {
  /** Names are for safety/admin (whole building) and floor_head (own floor). */
  canSeeNames: boolean;
  rows: EvacRosterRow[];
  /** Per-floor expected/confirmed/missing — floors with missing people first. */
  floors: EvacFloorStat[];
}

export async function sessionView(
  session: IEvacuation,
  user: AuthUser
): Promise<SessionView> {
  const scope = getEvacuationScope(user.role);
  const allowed = await accessibleFloorIds(user, scope);

  const inScope = (entry: IRosterEntry) =>
    !allowed ||
    (!!entry.floorId && allowed.has(entry.floorId.toString()));

  const canSeeNames = scope !== "none";
  const rows = canSeeNames ? session.roster.filter(inScope).map(toRow) : [];

  const byFloor = new Map<string, EvacFloorStat>();
  for (const entry of session.roster) {
    if (!entry.floorId || !inScope(entry)) continue;
    const id = entry.floorId.toString();
    const stat = byFloor.get(id) ?? {
      floorId: id,
      name: entry.floorName || strings.unknownFloor,
      expected: 0,
      confirmed: 0,
      missing: 0,
    };
    stat.expected += 1;
    if (entry.confirmedAt) stat.confirmed += 1;
    else stat.missing += 1;
    byFloor.set(id, stat);
  }

  const floors = Array.from(byFloor.values()).sort(
    (a, b) =>
      b.missing - a.missing ||
      b.expected - a.expected ||
      a.name.localeCompare(b.name)
  );

  return { canSeeNames, rows, floors };
}

/**
 * The full payload the full-screen display renders: light session + scoped
 * floor locations, with names only when the caller's role allows them. Used
 * by GET ?roster=1 AND by the server layout (so the takeover is SSR'd with
 * no flash of the normal shell).
 */
export async function displayPayload(
  session: IEvacuation,
  user: AuthUser
): Promise<EvacuationLight> {
  const light = lightSession(session, user.id);
  const { canSeeNames, rows, floors } = await sessionView(session, user);
  light.rosterVisible = canSeeNames;
  light.floors = floors;
  if (canSeeNames) light.roster = rows;
  return light;
}

/**
 * The complete GET response — one source of truth shared by the API route
 * and the server layout's SSR fallback (same key, same shape, no flash).
 *
 * `history` returns the after-action report list; it is silently omitted for
 * roles without evacuation:view_report (same pattern as roster names).
 */
export async function evacuationResponse(
  user: AuthUser,
  opts: { roster: boolean; closed: boolean; history?: boolean }
): Promise<EvacuationResponse> {
  const payload: EvacuationResponse = { session: null };

  const active = await Evacuation.findOne({ status: "active" });
  if (active) {
    payload.session = opts.roster
      ? await displayPayload(active, user)
      : lightSession(active, user.id);
  }

  if (opts.closed) {
    const last = await Evacuation.findOne({ status: "closed" }).sort({
      closedAt: -1,
    });
    payload.lastClosed = last
      ? {
          startedAt: last.startedAt.toISOString(),
          closedAt: (last.closedAt ?? last.startedAt).toISOString(),
          counts: countsFor(last.roster),
        }
      : null;
  }

  if (opts.history && can(user.role, "evacuation:view_report")) {
    // Counts are computed inside the aggregation ($size/$filter) so the
    // rosters of up to 50 past sessions never travel to the client.
    const rows = await Evacuation.aggregate<{
      _id: Types.ObjectId;
      startedAt: Date;
      closedAt: Date;
      startedByName: string;
      total: number;
      confirmed: number;
    }>([
      { $match: { status: "closed" } },
      { $sort: { closedAt: -1 } },
      { $limit: 50 },
      {
        $project: {
          startedAt: 1,
          closedAt: 1,
          startedByName: 1,
          total: { $size: "$roster" },
          confirmed: {
            $size: {
              $filter: {
                input: "$roster",
                as: "entry",
                cond: "$$entry.confirmedAt",
              },
            },
          },
        },
      },
    ]);

    payload.history = rows.map((row) => ({
      _id: row._id.toString(),
      startedAt: row.startedAt.toISOString(),
      closedAt: (row.closedAt ?? row.startedAt).toISOString(),
      startedByName: row.startedByName,
      counts: {
        total: row.total,
        confirmed: row.confirmed,
        missing: row.total - row.confirmed,
      },
    }));
  }

  return payload;
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
