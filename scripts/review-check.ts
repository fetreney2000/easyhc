/**
 * Read-only verification of the scope/RBAC changes (no writes).
 * Usage: npx tsx scripts/review-check.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

async function main(): Promise<void> {
  // Load .env.local (tsx does not do this) — never printed
  const envPath = resolve(process.cwd(), ".env.local");
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

  console.log("\n--- dept_head permissions ---");
  const checks: Array<[string, boolean]> = [
    ["attendance:view_all", rbac.can("dept_head", "attendance:view_all")],
    ["attendance:checkout_all", rbac.can("dept_head", "attendance:checkout_all")],
    ["reports:generate_all", rbac.can("dept_head", "reports:generate_all")],
    ["users:view_all", rbac.can("dept_head", "users:view_all")],
    ["locations:track_all", rbac.can("dept_head", "locations:track_all")],
    ["users:manage", rbac.can("dept_head", "users:manage")],
    [
      "attendance:view_department",
      rbac.can("dept_head", "attendance:view_department"),
    ],
    [
      "attendance:checkout_department",
      rbac.can("dept_head", "attendance:checkout_department"),
    ],
    [
      "reports:generate_department",
      rbac.can("dept_head", "reports:generate_department"),
    ],
    ["users:view_department", rbac.can("dept_head", "users:view_department")],
    ["locations:track_department", rbac.can("dept_head", "locations:track_department")],
    ["floors:view_all", rbac.can("dept_head", "floors:view_all")],
    ["profile:edit_own", rbac.can("dept_head", "profile:edit_own")],
  ];
  for (const [action, result] of checks) {
    console.log(`  ${action.padEnd(32)} = ${result}`);
  }

  console.log("\n--- force checkout outside a boundary must be denied ---");
  const record = {
    type: "employee" as const,
    userId: "64f0abc12345678901234567",
    floorId: "64f0abc12345678901234567",
  };
  for (const role of ["unit_head", "dept_head", "floor_head"] as const) {
    console.log(
      `  ${role.padEnd(11)} without ${role === "dept_head" ? "jabatanId" : "unitId"} -> ${await scope.canForceCheckoutRecord(
        { id: "64f0abc12345678901234567", role },
        record
      )}`
    );
  }

  // Unresolvable scopes must fail closed (null = no data), never unscoped
  console.log("\n--- fail closed ---");
  console.log(
    "  floor_head w/o unitId (attendance)  ->",
    await scope.scopeFilter(
      { id: "not-an-objectid", role: "floor_head" },
      rbac.getAttendanceScope("floor_head")
    )
  );
  console.log(
    "  dept_head w/o jabatanId (attendance)->",
    await scope.scopeFilter(
      { id: "64f0abc12345678901234567", role: "dept_head" },
      rbac.getAttendanceScope("dept_head")
    )
  );
  console.log(
    "  unit_head w/o unitId (users)        ->",
    await scope.usersScopeFilter(
      { id: "64f0abc12345678901234567", role: "unit_head" },
      rbac.getUsersScope("unit_head")
    )
  );
  console.log(
    "  malformed actor id (own)            ->",
    await scope.scopeFilter({ id: "zzz", role: "user" }, "own")
  );

  // Optional: only runs when Atlas is reachable from here
  try {
    await connectDB();
    console.log(
      `\ndb reachable: users=${await User.countDocuments()} units=${await Unit.countDocuments()} floors=${await Floor.countDocuments()}`
    );
  } catch (error) {
    console.log(`\ndb unreachable, counts skipped: ${(error as Error).message.slice(0, 80)}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("CHECK FAILED:", error);
  process.exit(1);
});
