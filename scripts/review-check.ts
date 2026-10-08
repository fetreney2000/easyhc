/**
 * Read-only verification of the scope/RBAC changes (no writes).
 * Usage: npx tsx scripts/review-check.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import type { Action } from "@/lib/auth/rbac";
import type { Role } from "@/lib/db/types";

async function main(): Promise<void> {
  // Load .env.local (tsx does not do this) — never printed
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error(
      "FAILED: .env.local not found — create it (MONGODB_URI, NEXTAUTH_SECRET) first."
    );
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
  process.env.NEXTAUTH_SECRET ||= "dev-secret-for-checks";

  const { connectDB } = await import("@/lib/db/mongoose");
  const User = (await import("@/lib/db/models/User")).default;
  const Unit = (await import("@/lib/db/models/Unit")).default;
  const Floor = (await import("@/lib/db/models/Floor")).default;
  const scope = await import("@/lib/auth/scope");
  const rbac = await import("@/lib/auth/rbac");
  const { ROLES } = await import("@/lib/db/types");

  // [label, actual, expected] permission assertions are collected here
  const results: Array<[string, boolean, string]> = [];

  // --- pure logic checks (no database needed) -------------------------
  console.log("\n--- scope per role ---");
  for (const role of ROLES) {
    console.log(
      `${role.padEnd(11)} attendance=${rbac
        .getAttendanceScope(role)
        .padEnd(10)} reports=${rbac
        .getReportsScope(role)
        .padEnd(10)} users=${rbac.getUsersScope(role).padEnd(10)} checkout=${rbac.getCheckoutScope(role)}`
    );
  }

  console.log("\n--- permission matrix (expected values are asserted) ---");
  const expectations: Array<[string, boolean, boolean]> = [
    // dept_head: department scope, no admin work, no global/floor scope
    ["dept_head attendance:checkout_all", rbac.can("dept_head", "attendance:checkout_all"), false],
    ["dept_head attendance:checkout_department", rbac.can("dept_head", "attendance:checkout_department"), true],
    ["dept_head attendance:checkout_own_floor (stray)", rbac.can("dept_head", "attendance:checkout_own_floor"), false],
    ["dept_head reports:generate_own_floor (stray)", rbac.can("dept_head", "reports:generate_own_floor"), false],
    ["dept_head users:manage", rbac.can("dept_head", "users:manage"), false],
    ["dept_head floors:view_all", rbac.can("dept_head", "floors:view_all"), true],
    // unit_head: unit scope only — floor scope is a stray
    ["unit_head attendance:checkout_own_unit", rbac.can("unit_head", "attendance:checkout_own_unit"), true],
    ["unit_head attendance:checkout_own_floor (stray)", rbac.can("unit_head", "attendance:checkout_own_floor"), false],
    ["unit_head reports:generate_own_unit", rbac.can("unit_head", "reports:generate_own_unit"), true],
    // safety_head: emergency role — full visibility + building-wide checkout
    ["safety_head attendance:checkout_all", rbac.can("safety_head", "attendance:checkout_all"), true],
    ["safety_head locations:track_all", rbac.can("safety_head", "locations:track_all"), true],
    ["safety_head users:manage", rbac.can("safety_head", "users:manage"), false],
    // floor_head
    ["floor_head attendance:checkout_own_floor", rbac.can("floor_head", "attendance:checkout_own_floor"), true],
    ["floor_head attendance:manual_checkin", rbac.can("floor_head", "attendance:manual_checkin"), false],
    // plain employee: the board for their own floor, own history only
    ["user floors:view_own_floor", rbac.can("user", "floors:view_own_floor"), true],
    ["user users:manage", rbac.can("user", "users:manage"), false],
    ["user reports:generate_own", rbac.can("user", "reports:generate_own"), true],
    ["user reports:generate_all", rbac.can("user", "reports:generate_all"), false],
    ["user report scope is own", rbac.getReportsScope("user") === "own", true],
    ["user attendance scope live=floor", rbac.getAttendanceScope("user") === "own_and_floor", true],
    // admin: everything except managing admins
    ["admin users:manage_admin", rbac.can("admin", "users:manage_admin"), false],
    ["admin floors:manage", rbac.can("admin", "floors:manage"), true],
    // Regression guards for the deny-by-default flip: these three roles must
    // still hold every grant their nav/report/checkout OR-chains rely on
    ["dept_head floors:view_all", rbac.can("dept_head", "floors:view_all"), true],
    ["dept_head reports:generate_department", rbac.can("dept_head", "reports:generate_department"), true],
    ["dept_head locations:track_department", rbac.can("dept_head", "locations:track_department"), true],
    ["unit_head floors:view_own_floor", rbac.can("unit_head", "floors:view_own_floor"), true],
    ["unit_head reports:generate_own_unit", rbac.can("unit_head", "reports:generate_own_unit"), true],
    ["unit_head locations:track_own_unit", rbac.can("unit_head", "locations:track_own_unit"), true],
    ["floor_head reports:generate_own_floor", rbac.can("floor_head", "reports:generate_own_floor"), true],
    ["floor_head locations:track_own_unit (still denied)", rbac.can("floor_head", "locations:track_own_unit"), false],
    ["dept_head floors:view_own_floor (harmless, view_all covers nav)", rbac.can("dept_head", "floors:view_own_floor"), false],
  ];
  for (const [label, actual, expected] of expectations) {
    results.push([label, actual === expected, `expected ${expected}`]);
  }

  // FULL evacuation matrix — every role × every evacuation action. The old
  // hand-picked rows missed 12 of 35 cells, precisely the ones served by
  // the switches' default branches.
  console.log("\n--- evacuation matrix (role × action) ---");
  const activators: Role[] = ["superadmin", "admin", "safety_head", "floor_head"];
  const allRoles: Role[] = [...ROLES];
  const evacMatrix: Array<[Action, Role[]]> = [
    ["evacuation:confirm_own", allRoles], // every role self-confirms
    ["evacuation:confirm_others", activators],
    ["evacuation:start", activators],
    ["evacuation:close", activators],
    ["evacuation:view_report", activators],
  ];
  for (const [action, allowed] of evacMatrix) {
    for (const role of allRoles) {
      const expected = allowed.includes(role);
      results.push([
        `${role} ${action}`,
        rbac.can(role, action) === expected,
        `expected ${expected}`,
      ]);
    }
  }

  // Scope helpers must agree with can() (the file's own stated invariant)
  const scopeExpectations: Array<[string, string, string]> = [
    ["superadmin", rbac.getEvacuationScope("superadmin"), "all"],
    ["admin", rbac.getEvacuationScope("admin"), "all"],
    ["safety_head", rbac.getEvacuationScope("safety_head"), "all"],
    ["floor_head", rbac.getEvacuationScope("floor_head"), "own_floor"],
    ["dept_head", rbac.getEvacuationScope("dept_head"), "none"],
    ["unit_head", rbac.getEvacuationScope("unit_head"), "none"],
    ["user", rbac.getEvacuationScope("user"), "none"],
  ];
  for (const [role, actual, expected] of scopeExpectations) {
    results.push([
      `${role} evacuation scope is ${expected}`,
      actual === expected,
      `expected ${expected}`,
    ]);
  }

  console.log("\n--- force checkout outside a boundary must be denied ---");
  const record = {
    type: "employee" as const,
    userId: "64f0abc12345678901234567",
    floorId: "64f0abc12345678901234567",
  };
  for (const role of ["unit_head", "dept_head", "floor_head"] as const) {
    const allowed = await scope.canForceCheckoutRecord(
      { id: "64f0abc12345678901234567", role },
      record
    );
    console.log(
      `  ${role.padEnd(11)} without ${role === "dept_head" ? "jabatanId" : "unitId"} -> ${allowed}`
    );
    // Asserted, not just printed: this section used to be console.log-only
    // and could never fail the run
    results.push([
      `force checkout denied for ${role} without membership`,
      allowed === false,
      `got ${allowed}`,
    ]);
  }

  // Unresolvable scopes must fail closed (null = no data / empty match),
  // never unscoped — asserted, not just printed
  const filterMatchesNothing = (value: unknown): boolean => {
    if (value === null) return true;
    const filter = value as {
      _id?: { $in?: unknown[] };
      $or?: Array<{ _id?: { $in?: unknown[] } }>;
    };
    if (Array.isArray(filter.$or)) {
      return filter.$or.every(
        (branch) => (branch._id?.$in ?? []).length === 0
      );
    }
    return Array.isArray(filter._id?.$in) && filter._id.$in.length === 0;
  };

  console.log("\n--- fail closed (asserted) ---");
  const failClosedProbes: Array<[string, unknown]> = [
    [
      "floor_head w/o unitId (attendance)",
      await scope.scopeFilter(
        { id: "not-an-objectid", role: "floor_head" },
        rbac.getAttendanceScope("floor_head")
      ),
    ],
    [
      "dept_head w/o jabatanId (attendance)",
      await scope.scopeFilter(
        { id: "64f0abc12345678901234567", role: "dept_head" },
        rbac.getAttendanceScope("dept_head")
      ),
    ],
    [
      "unit_head w/o unitId (users)",
      await scope.usersScopeFilter(
        { id: "64f0abc12345678901234567", role: "unit_head" },
        rbac.getUsersScope("unit_head")
      ),
    ],
    [
      "malformed actor id (own)",
      await scope.scopeFilter({ id: "zzz", role: "user" }, "own"),
    ],
    [
      "user own_and_floor w/o unit",
      await scope.scopeFilter(
        { id: "zzz", role: "user" },
        rbac.getAttendanceScope("user")
      ),
    ],
  ];
  for (const [label, value] of failClosedProbes) {
    console.log(`  ${label.padEnd(36)} ->`, value);
    results.push([
      `fail closed: ${label}`,
      filterMatchesNothing(value),
      JSON.stringify(value),
    ]);
  }

  // Optional: only runs when Atlas is reachable from here
  try {
    await connectDB();
    console.log(
      `\ndb reachable: users=${await User.countDocuments()} units=${await Unit.countDocuments()} floors=${await Floor.countDocuments()}`
    );
  } catch (error) {
    console.log(`\ndb unreachable, counts skipped: ${(error as Error).message.slice(0, 80)}`);
  }

  console.log("");
  let failed = 0;
  for (const [name, ok, detail] of results) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} permission checks passed`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("CHECK FAILED:", error);
  process.exit(1);
});
