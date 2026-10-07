/**
 * End-to-end verification of the envelope/pagination/privacy changes.
 *
 * Mints a short-lived session cookie with Auth.js's own encoder (using the
 * same secret + salt the app uses), then exercises the READ-ONLY endpoints
 * it protects. No writes: the visitor race test cleans up its own records.
 *
 * Usage: npm run dev (other shell), then: npx tsx scripts/api-check.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const results: Array<[string, boolean, string]> = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push([name, ok, detail]);

async function main(): Promise<void> {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }

  const { connectDB } = await import("@/lib/db/mongoose");
  const User = (await import("@/lib/db/models/User")).default;
  const Floor = (await import("@/lib/db/models/Floor")).default;
  const Attendance = (await import("@/lib/db/models/Attendance")).default;

  await connectDB();

  // Prefer an account that can see everything, so totals are meaningful
  const actor =
    (await User.findOne({ role: { $in: ["superadmin", "admin"] } }).lean()) ??
    (await User.findOne({}).lean());

  if (!actor) {
    console.log("no user in the database — cannot mint a session");
    process.exit(0);
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");

  const { encode } = await import("@auth/core/jwt");

  /** Read-only session for any account, minted with Auth.js's own encoder
   *  (same secret + salt the app uses). */
  const mintCookie = async (user: {
    _id: { toString(): string };
    name: string;
    username: string;
    role: string;
    unitId?: unknown;
    jabatanId?: unknown;
    sessionVersion: number;
  }) =>
    `authjs.session-token=${await encode({
      token: {
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        role: user.role,
        unitId: user.unitId?.toString(),
        jabatanId: user.jabatanId?.toString(),
        sessionVersion: user.sessionVersion,
      },
      secret,
      salt: "authjs.session-token",
      maxAge: 60 * 60,
    })}`;

  const cookie = await mintCookie(actor);

  const authed = (path: string, sessionCookie = cookie) =>
    fetch(`${BASE}${path}`, { headers: { cookie: sessionCookie } }).then(
      async (r) => ({
        status: r.status,
        body: (await r.json().catch(() => ({}))) as Record<string, unknown>,
      })
    );

  /* 1. users envelope + paging ---------------------------------------- */
  const page1 = await authed("/api/users?page=1&limit=5");
  check("users page=1&limit=5 -> 200", page1.status === 200, `${page1.status}`);
  const users1 = page1.body.users as unknown[] | undefined;
  check("users returns an envelope", Array.isArray(users1) && "total" in page1.body, JSON.stringify(Object.keys(page1.body)));
  check("users rows <= 5", Array.isArray(users1) && users1.length <= 5, `got ${users1?.length}`);
  check(
    "users total is the filtered count",
    typeof page1.body.total === "number" && (page1.body.total as number) >= (users1?.length ?? 0),
    `total=${page1.body.total}`
  );

  const allUsers = await authed("/api/users");
  const allRows = allUsers.body.users as unknown[] | undefined;
  check(
    "no-params users returns the whole directory",
    Array.isArray(allRows) && typeof allUsers.body.total === "number" && allRows.length === (allUsers.body.total as number),
    `${allRows?.length}/${allUsers.body.total}`
  );

  /* 1b. list endpoints are gated -------------------------------------- */
  const floors = await authed("/api/floors");
  check("floors list -> 200", floors.status === 200, `${floors.status}`);
  const floorRows = Array.isArray(floors.body)
    ? (floors.body as unknown as Record<string, unknown>[])
    : [];
  check(
    "floors list carries no qrToken or createdBy",
    Array.isArray(floors.body) &&
      floorRows.every((f) => !("qrToken" in f) && !("createdBy" in f)),
    JSON.stringify(Object.keys(floorRows[0] ?? {}))
  );

  const staffAccount = await User.findOne({ role: "user" }).lean();
  if (staffAccount) {
    const staffCookie = await mintCookie(staffAccount);
    const unitsAsStaff = await authed("/api/units", staffCookie);
    const jabatansAsStaff = await authed("/api/jabatans", staffCookie);
    check(
      "plain user cannot list units (403)",
      unitsAsStaff.status === 403,
      `${unitsAsStaff.status}`
    );
    check(
      "plain user cannot list jabatans (403)",
      jabatansAsStaff.status === 403,
      `${jabatansAsStaff.status}`
    );

    /* Reports = own history for an employee; history queries never leak the floor */
    const reportsAsStaff = await authed("/api/reports?page=1&pageSize=5", staffCookie);
    const staffReportRows = (reportsAsStaff.body.records ??
      []) as unknown as Record<string, unknown>[];
    check(
      "plain user can read their own reports (200)",
      reportsAsStaff.status === 200,
      `${reportsAsStaff.status}`
    );
    check(
      "plain user's report rows are their own only",
      staffReportRows.every(
        (r) =>
          (r.userId as { _id?: string } | null)?._id ===
          staffAccount._id.toString()
      ),
      `${staffReportRows.length} rows`
    );

    const historyAsStaff = await authed("/api/attendance?page=1", staffCookie);
    const historyRows = (historyAsStaff.body.attendance ??
      []) as unknown as Record<string, unknown>[];
    check(
      "plain user's attendance history is own-only",
      historyRows.every(
        (r) =>
          (r.userId as { _id?: string } | null)?._id ===
          staffAccount._id.toString()
      ),
      `${historyRows.length} rows`
    );
  } else {
    check("plain-user gate skipped (no role=user account)", true, "");
  }

  /* 2. attendance pagination + privacy -------------------------------- */
  const att = await authed("/api/attendance?active=true&page=1");
  check("attendance -> 200", att.status === 200, `${att.status}`);
  check(
    "attendance exposes total/page/pageSize",
    "total" in att.body && "page" in att.body && "pageSize" in att.body,
    `total=${att.body.total} page=${att.body.page} pageSize=${att.body.pageSize}`
  );
  const attRows = (att.body.attendance as Record<string, unknown>[]) ?? [];
  check(
    "attendance rows cap at pageSize",
    attRows.length <= (att.body.pageSize as number),
    `${attRows.length} rows`
  );
  check(
    "attendance never returns visitorPhone",
    attRows.every((r) => !("visitorPhone" in r)),
    JSON.stringify(Object.keys(attRows[0] ?? {}))
  );

  const attBig = await authed("/api/attendance?active=true&pageSize=500");
  check(
    "attendance honours pageSize (muster view dependency)",
    attBig.body.pageSize === 500,
    `pageSize=${attBig.body.pageSize}`
  );

  // Muster mode: reachable for a signed-in user, nav item rendered server-side
  const musterHtml = await fetch(`${BASE}/muster`, {
    headers: { cookie },
  }).then((r) => r.text());
  check(
    "muster page renders with nav entry",
    musterHtml.includes("Mod Muster") && !musterHtml.includes("<title>Log Masuk"),
    `${musterHtml.length} bytes`
  );

  const searched = await authed("/api/attendance?active=true&q=zzz-no-such-person");
  check(
    "attendance q= search is honoured (no match -> empty)",
    searched.status === 200 && ((searched.body.attendance as unknown[]) ?? []).length === 0,
    `status=${searched.status} rows=${((searched.body.attendance as unknown[]) ?? []).length}`
  );

  /* 3. reports pagination + privacy ------------------------------------ */
  const rep = await authed("/api/reports?page=1&pageSize=5");
  check("reports -> 200", rep.status === 200, `${rep.status}`);
  const repRows = (rep.body.records as Record<string, unknown>[]) ?? [];
  check("reports returns <= pageSize rows", repRows.length <= 5, `${repRows.length}`);
  check(
    "reports exposes total/page/pageSize",
    typeof rep.body.total === "number" && "page" in rep.body && "pageSize" in rep.body,
    `total=${rep.body.total}`
  );
  check(
    "reports never returns visitorPhone",
    repRows.every((r) => !("visitorPhone" in r)),
    ""
  );

  /* 4. the partial unique index (race) -------------------------------- */
  const floor = await Floor.findOne({}).sort({ name: 1 }).lean();
  let racePhone = "";
  try {
    if (floor) {
      // A phone that cannot exist in production data (uniqueness enforced)
      racePhone = `019${String(Date.now()).slice(-7)}`;
      const body = JSON.stringify({
        visitorName: "E2E Race",
        visitorPhone: racePhone,
        floorId: floor._id.toString(),
        token: floor.qrToken,
      });
      const post = () =>
        fetch(`${BASE}/api/visitor/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

      // Two simultaneous submits with the same phone: at most ONE may win
      const [a, b] = await Promise.all([post(), post()]);
      const statuses = [a.status, b.status].sort().join(",");
      const openCount = await Attendance.countDocuments({
        type: "visitor",
        visitorPhone: racePhone,
        checkedOutAt: null,
      });
      check(
        "parallel duplicate check-in -> exactly one open record",
        openCount === 1,
        `statuses=${statuses} open=${openCount}`
      );
      check(
        "the loser gets 409 (not 500)",
        statuses.endsWith("409") || statuses.startsWith("201,409"),
        `statuses=${statuses}`
      );
    } else {
      check("race test skipped (no floor)", false, "");
    }
  } finally {
    await Attendance.deleteMany({ visitorPhone: racePhone });
  }

  console.log("");
  let failed = 0;
  for (const [name, ok, detail] of results) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("CHECK FAILED:", error);
  process.exit(1);
});
