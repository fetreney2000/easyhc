/**
 * End-to-end verification of the app's API surface.
 *
 * Mints a short-lived session cookie with Auth.js's own encoder (using the
 * same secret + salt the app uses), then exercises the endpoints it
 * protects: reads, plus the visitor-race and evacuation flows, which WRITE
 * and clean up after themselves (an interrupted run is swept at the start of
 * the next one; a non-test ACTIVE session fails the run instead of being
 * silently skipped).
 *
 * DB-WRITE GUARD: write sections are skipped unless the database is local OR
 * E2E_WRITES=1 is set. .env.local usually points at the same Atlas cluster
 * the deployed app uses, and an evacuation session created here flashes the
 * real full-screen takeover onto every open screen of the production app.
 *
 * Usage: npm run dev (other shell), then: npx tsx scripts/api-check.ts
 *        (E2E_WRITES=1 allows writes to a remote database)
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
/** Outcome "skip" = a fixture/permission was unavailable — reported as SKIP,
 *  never dressed up as PASS. */
const results: Array<[string, boolean | "skip", string]> = [];
const check = (name: string, ok: boolean, detail = "") =>
  results.push([name, ok, detail]);
const skip = (name: string, detail = "") =>
  results.push([name, "skip", detail]);

async function main(): Promise<void> {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error(
      "FAILED: .env.local not found — create it (MONGODB_URI, NEXTAUTH_SECRET) first."
    );
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }

  const { connectDB } = await import("@/lib/db/mongoose");
  const User = (await import("@/lib/db/models/User")).default;
  const Floor = (await import("@/lib/db/models/Floor")).default;
  const Attendance = (await import("@/lib/db/models/Attendance")).default;
  const AuditLog = (await import("@/lib/db/models/AuditLog")).default;
  const Evacuation = (await import("@/lib/db/models/Evacuation")).default;
  const { strings } = await import("@/lib/i18n/strings");

  await connectDB();

  // --- DB-write guard (see header) --------------------------------------
  const dbIsLocal = /localhost|127\.0\.0\.1/.test(
    process.env.MONGODB_URI ?? ""
  );
  const allowWrites = dbIsLocal || process.env.E2E_WRITES === "1";
  if (!allowWrites) {
    console.log(
      "WRITE GUARD: database is not local and E2E_WRITES is not set — " +
        "visitor-race and evacuation sections will be SKIPPED."
    );
  }

  // --- Sweep marker-tagged debris from interrupted runs ------------------
  const sweptVisitors = await Attendance.deleteMany({
    type: "visitor",
    visitorName: { $in: ["E2E Pelawat", "E2E Race"] },
    checkedOutAt: null,
  });
  if (sweptVisitors.deletedCount > 0) {
    console.log(
      `swept ${sweptVisitors.deletedCount} stale test visitor record(s) from an interrupted run`
    );
  }
  // Leftover floors from interrupted stale-poster runs — same guard as
  // every other write section, and never a floor that somehow gained a
  // check-in (the DELETE route refuses those for the same reason)
  if (allowWrites) {
    const leftoverFloors = await Floor.find({
      name: { $regex: "^E2E QR Rotasi" },
    })
      .select("_id")
      .lean();
    for (const leftover of leftoverFloors) {
      const used = await Attendance.countDocuments({ floorId: leftover._id });
      if (used === 0) await Floor.deleteOne({ _id: leftover._id });
    }
  }

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
  check(
    "superadmin never appears in staff listings",
    (allRows ?? []).every(
      (u) => (u as { role?: string }).role !== "superadmin"
    ),
    JSON.stringify(((allRows ?? []) as { role?: string }[]).map((u) => u.role))
  );
  const saFilter = await authed("/api/users?role=superadmin");
  check(
    "explicit ?role=superadmin returns nothing (hidden)",
    ((saFilter.body.users as unknown[]) ?? []).length === 0,
    `rows=${((saFilter.body.users as unknown[]) ?? []).length}`
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

    // Normal mode: the evacuation menu/button is for ACTIVATORS only
    const dashAsStaff = await fetch(`${BASE}/dashboard`, {
      headers: { cookie: staffCookie },
    }).then((r) => r.text());
    check(
      "plain user's dashboard hides evacuation mode",
      !dashAsStaff.includes("Mod Evakuasi"),
      `${dashAsStaff.length} bytes`
    );
  } else {
    skip("plain-user gate (no role=user account)");
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
  if (attRows.length > 0) {
    // every() over an empty array would be a vacuous PASS — skip loudly instead
    check(
      "attendance never returns visitorPhone",
      attRows.every((r) => !("visitorPhone" in r)),
      JSON.stringify(Object.keys(attRows[0] ?? {}))
    );
  } else {
    skip("attendance visitorPhone privacy (no active rows to inspect)");
  }

  /* recent check-outs feed (the dashboard's "Daftar Keluar Terkini") */
  const checkedOutFeed = await authed(
    "/api/attendance?checkedOut=true&page=1&pageSize=5"
  );
  check(
    "check-outs feed -> 200 with rows",
    checkedOutFeed.status === 200 && Array.isArray(checkedOutFeed.body.attendance),
    `${checkedOutFeed.status}`
  );
  const outRows = (checkedOutFeed.body.attendance as Array<Record<string, unknown>>) ?? [];
  if (outRows.length > 0) {
    const closed = outRows.every((r) => typeof r.checkedOutAt === "string");
    const sortedDesc = outRows.every(
      (row, i) =>
        i === 0 ||
        String(outRows[i - 1].checkedOutAt) >= String(row.checkedOutAt)
    );
    check(
      "check-outs feed: all closed, newest-checked-out first",
      closed && sortedDesc,
      `${outRows.length} rows`
    );
  } else {
    skip("check-outs feed ordering (no closed rows yet)");
  }

  /* plain employee: the departures feed is floor-wide like the arrivals
     feed (own records + the unit's home floor) — but ONLY in its bounded
     feed shape; a bigger page, deeper paging or a search is history and
     stays own-only */
  {
    const Unit = (await import("@/lib/db/models/Unit")).default;
    const plain = await User.findOne({
      role: "user",
      status: "active",
      unitId: { $ne: null },
    }).lean();
    const unit = plain?.unitId
      ? await Unit.findById(plain.unitId).select("homeFloorId").lean()
      : null;
    const homeFloorIds = unit?.homeFloorId ? [unit.homeFloorId] : [];

    if (plain && homeFloorIds.length > 0) {
      const plainId = plain._id.toString();
      const plainCookie = await mintCookie(plain);
      const asPlain = (path: string) =>
        fetch(`${BASE}${path}`, { headers: { cookie: plainCookie } }).then(
          async (r) => ({
            status: r.status,
            body: (await r.json().catch(() => ({}))) as {
              attendance?: Array<
                Record<string, unknown> & { _id?: unknown; userId?: { _id?: unknown } | null }
              >;
              total?: number;
            },
          })
        );

      // The exact row set the bounded feed MUST return — computed straight
      // from the DB so an own-only regression cannot sneak a pass
      const expected = await Attendance.find({
        $or: [
          { type: "employee", userId: plain._id },
          { floorId: { $in: homeFloorIds } },
        ],
        checkedOutAt: { $ne: null },
      })
        .sort({ checkedOutAt: -1 })
        .limit(5)
        .select("_id")
        .lean();
      const expectedIds = new Set(expected.map((r) => r._id.toString()));
      const floorOthers = await Attendance.countDocuments({
        floorId: { $in: homeFloorIds },
        checkedOutAt: { $ne: null },
        userId: { $ne: plain._id },
      });

      if (expectedIds.size === 0) {
        skip(
          "plain-user departures feed scope (no closed records on own + home floor yet)"
        );
      } else {
        const feed = await asPlain(
          "/api/attendance?checkedOut=true&page=1&pageSize=5"
        );
        const feedRows = feed.body.attendance ?? [];
        const gotIds = feedRows.map((r) => r._id?.toString() ?? "");
        check(
          "plain user: departures feed = newest own + home-floor rows",
          feed.status === 200 &&
            gotIds.length === expectedIds.size &&
            gotIds.every((id) => expectedIds.has(id)),
          `status=${feed.status} api=${gotIds.length} db=${expectedIds.size}`
        );
        check(
          "plain user: feed envelope is clamped (not floor history count)",
          feed.status === 200 && feed.body.total === gotIds.length,
          `total=${feed.body.total} rows=${gotIds.length}`
        );

        if (floorOthers > 0) {
          // Beyond the feed shape the floor's history must vanish entirely
          const wide = await asPlain(
            "/api/attendance?checkedOut=true&page=1&pageSize=1000"
          );
          const paged = await asPlain(
            "/api/attendance?checkedOut=true&page=2&pageSize=5"
          );
          const wideRows = wide.body.attendance ?? [];
          const pagedRows = paged.body.attendance ?? [];
          const allOwn = [...wideRows, ...pagedRows].every(
            (r) => r.userId?._id?.toString() === plainId
          );
          check(
            "plain user: bigger page or page=2 degrades to own-only",
            wide.status === 200 && paged.status === 200 && allOwn,
            `wide=${wideRows.length} paged=${pagedRows.length} rows (${floorOthers} floor records exist)`
          );

          // A search narrowing the window is HISTORY too: even in the small
          // shape, q must degrade to own-only
          const needle = (plain.name || "zz").slice(0, 3);
          const searched = await asPlain(
            `/api/attendance?checkedOut=true&page=1&pageSize=5&q=${encodeURIComponent(needle)}`
          );
          check(
            "plain user: a searched feed shape degrades to own-only",
            searched.status === 200 &&
              (searched.body.attendance ?? []).every(
                (r) => r.userId?._id?.toString() === plainId
              ),
            `${(searched.body.attendance ?? []).length} rows (q=${needle})`
          );
        } else {
          skip(
            "plain-user beyond-feed degradation (no floor history to exclude)"
          );
        }
      }
    } else {
      skip("plain-user feed scope (no plain staff with a home floor)");
    }
  }

  const attBig = await authed("/api/attendance?active=true&pageSize=500");
  check(
    "attendance honours pageSize",
    attBig.body.pageSize === 500,
    `pageSize=${attBig.body.pageSize}`
  );

  // Evacuation mode: reachable for a signed-in user, nav rendered server-side
  const evacHtml = await fetch(`${BASE}/evacuation`, {
    headers: { cookie },
  }).then((r) => r.text());
  check(
    "evacuation page renders with nav entry",
    evacHtml.includes("Mod Evakuasi") && !evacHtml.includes("<title>Log Masuk"),
    `${evacHtml.length} bytes`
  );
  const oldMusterUrl = await fetch(`${BASE}/muster?from=bookmark`, {
    headers: { cookie },
  });
  check(
    "/muster redirects to /evacuation (query preserved)",
    oldMusterUrl.url.endsWith("/evacuation?from=bookmark"),
    oldMusterUrl.url
  );

  /* Staff access QR + the no-bookmark nudge ----------------------------- */
  const appQr = await fetch(`${BASE}/api/qr/app`);
  const appQrType = appQr.headers.get("content-type") ?? "";
  check(
    "staff access QR serves image/png",
    appQr.status === 200 && appQrType.includes("image/png"),
    `${appQr.status} ${appQrType}`
  );
  const encodedQrUrl = appQr.headers.get("x-qr-url") ?? "";
  check(
    "staff access QR encodes this deployment's origin",
    encodedQrUrl === BASE.replace(/\/$/, ""),
    `encoded=${encodedQrUrl} expected=${BASE}`
  );
  // The production path: origin assembled from forwarded headers (this is
  // the branch that replaces the request.url parsing which threw in prod)
  const forwardedQr = await fetch(`${BASE}/api/qr/app`, {
    headers: {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "easyhc.example",
    },
  });
  check(
    "staff QR honours forwarded proto/host (production path)",
    (forwardedQr.headers.get("x-qr-url") ?? "") === "https://easyhc.example",
    forwardedQr.headers.get("x-qr-url") ?? "none"
  );
  const loginHtml = await fetch(`${BASE}/login`).then((r) => r.text());
  check(
    "login page shows the add-to-home-screen tip",
    loginHtml.includes(strings.loginAddToHomeTip),
    `${loginHtml.length} bytes`
  );
  check(
    "login page carries the full brand + organisation",
    loginHtml.includes(strings.appName) && loginHtml.includes(strings.appOrg),
    `${loginHtml.length} bytes`
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
  if (repRows.length > 0) {
    // every() over an empty array would be a vacuous PASS — skip loudly instead
    check(
      "reports never returns visitorPhone",
      repRows.every((r) => !("visitorPhone" in r)),
      ""
    );
  } else {
    skip("reports visitorPhone privacy (no rows to inspect)");
  }

  /* 4. the partial unique index (race) -------------------------------- */
  const floor = await Floor.findOne({}).sort({ name: 1 }).lean();
  let racePhone = "";
  if (!allowWrites) {
    skip("visitor race test (write guard)", "set E2E_WRITES=1 to run");
  }
  try {
    if (!allowWrites) {
      // guarded off — reported above
    } else if (floor) {
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
      skip("visitor race test (no floor)");
    }
  } finally {
    await Attendance.deleteMany({ visitorPhone: racePhone });
  }

  /* 5. evacuation session: start → confirm → privacy → close ------------- */
  // Prefer an activator who is NOT currently checked in: the takeover
  // assertions require an activator without a check-in, and live usage
  // means real accounts hold open records mid-morning. Falls back to the
  // natural-order pick, whose record the fixture then closes explicitly.
  const openEmployeeIds = await Attendance.distinct("userId", {
    type: "employee",
    checkedOutAt: null,
  });
  const evacActor =
    (await User.findOne({
      role: { $in: ["superadmin", "admin", "safety_head"] },
      status: "active",
      _id: { $nin: openEmployeeIds },
    }).lean()) ??
    (await User.findOne({
      role: { $in: ["superadmin", "admin", "safety_head"] },
      status: "active",
    }).lean());

  let evacCookie: string | null = null;
  if (!allowWrites) {
    skip("evacuation flow (write guard)", "set E2E_WRITES=1 to run");
  } else if (!evacActor) {
    skip("evacuation flow (no privileged account)");
  } else {
    const preExisting = await Evacuation.findOne({ status: "active" });
    const isTestDebris =
      !!preExisting &&
      (preExisting.roster ?? []).some(
        (entry) => entry.name === "E2E Pelawat"
      );
    if (preExisting && isTestDebris) {
      // Left behind by an interrupted run — sweep it and carry on
      await Evacuation.deleteOne({ _id: preExisting._id });
      console.log(
        "swept stale test evacuation session from an interrupted run"
      );
    }
    if (preExisting && !isTestDebris) {
      // A real drill (or unknown debris): FAIL loudly. Quietly skipping this
      // used to turn an interrupted run into a green run that tested nothing
      check(
        "evacuation flow blocked by a pre-existing ACTIVE session",
        false,
        `session ${preExisting._id.toString()} — close/clean it before running api-check`
      );
    } else {
      evacCookie = await mintCookie(evacActor);
    }
  }

  if (evacCookie) {
    let createdId: string | null = null;
    // Staff check-in fixtures (roster = open check-ins only) — ids kept for
    // the finally-cleanup even if the flow dies midway
    let plainFixtureId: string | null = null;
    let targetFixtureId: string | null = null;
    // REAL check-ins the fixtures temporarily closed — reopened in the
    // finally so live staff reappear on the board once the run is over
    const closedByFixture: unknown[] = [];
    // A visitor present in the building when the alarm goes off (roster
    // fixture) — later confirms through the PUBLIC endpoint
    const evacVisitorPhone = `018${String(Date.now()).slice(-7)}`;
    let visitorCheckin: {
      attendance?: { _id?: string };
      checkoutToken?: string;
    } | null = null;

    const call = (
      path: string,
      method: string,
      sessionCookie: string,
      body?: unknown
    ) =>
      fetch(`${BASE}${path}`, {
        method,
        headers: {
          cookie: sessionCookie,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }).then(async (r) => ({
        status: r.status,
        body: (await r.json().catch(() => ({}))) as Record<string, unknown>,
      }));

    try {
      /* The plain staff account — the gate + self-confirm subject. Hoisted
         to the top: the roster fixtures below need it */
      const plainUser =
        (staffAccount && staffAccount.status === "active"
          ? staffAccount
          : null) ??
        (await User.findOne({ role: "user", status: "active" }).lean());

      /* a visitor already checked in BEFORE the alarm (they land on the
         roster snapshot) */
      if (!floor) {
        skip("visitor pre-check-in (evacuation roster fixture)", "no floor");
      } else {
        const res = await fetch(`${BASE}/api/visitor/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorName: "E2E Pelawat",
            visitorPhone: evacVisitorPhone,
            floorId: floor._id.toString(),
            token: floor.qrToken,
          }),
        }).then(async (r) => ({
          status: r.status,
          body: (await r.json().catch(() => ({}))) as Record<string, unknown>,
        }));
        if (res.status === 201) {
          visitorCheckin = res.body as {
            attendance?: { _id?: string };
            checkoutToken?: string;
          };
        }
        check(
          "visitor pre-check-in (evacuation roster fixture)",
          !!visitorCheckin?.attendance?._id,
          `status=${res.status}`
        );
      }

      /* Staff fixtures: only people with an OPEN check-in land on the roster
         now — check in the plain user (gate + self-confirm) and a second
         staffer (the warden-tap target, left unconfirmed) */
      let expectedMin = visitorCheckin?.attendance?._id ? 1 : 0;
      // The partial unique index allows ONE open record per employee, and
      // these fixture accounts are real (possibly live-used) users: close
      // whatever they still hold before seating the fixture — remembering
      // the ids so the finally block can reopen them after the run
      const closeOpenFor = async (userId: unknown) => {
        const open = await Attendance.find({
          type: "employee",
          userId,
          checkedOutAt: null,
        })
          .select("_id")
          .lean();
        if (!open.length) return;
        const ids = open.map((r) => r._id);
        closedByFixture.push(...ids);
        await Attendance.updateMany(
          { _id: { $in: ids } },
          { $set: { checkedOutAt: new Date(), checkedOutBy: "fixture" } }
        );
      };
      // …and the SESSION VIEWER must have none either: the takeover
      // assertions below require an activator WITHOUT a check-in (an open
      // record from live usage would put them on their own roster and hand
      // them the "Saya Selamat" button)
      if (evacActor) await closeOpenFor(evacActor._id);
      if (floor && plainUser) {
        await closeOpenFor(plainUser._id);
        plainFixtureId = (
          await Attendance.create({
            type: "employee",
            userId: plainUser._id,
            floorId: floor._id,
            checkedInAt: new Date(),
            method: "manual",
          })
        )._id.toString();
        expectedMin += 1;
      }
      /* The warden-tap target: a staffer who lands on the roster and stays
         unconfirmed. MUST be disjoint from the session viewer (evacActor —
         a checked-in activator would get the "Saya Selamat" button and the
         stats-without-a-check-in assertions below would fail) and from the
         plain user (already excluded, one fixture per person). */
      const wardenTarget = floor
        ? await User.findOne({
            status: "active",
            role: { $ne: "superadmin" },
            _id: {
              $nin: [plainUser?._id, evacActor?._id].filter(
                (id): id is NonNullable<typeof id> => !!id
              ),
            },
          }).lean()
        : null;
      if (floor && wardenTarget) {
        await closeOpenFor(wardenTarget._id);
        targetFixtureId = (
          await Attendance.create({
            type: "employee",
            userId: wardenTarget._id,
            floorId: floor._id,
            checkedInAt: new Date(),
            method: "manual",
          })
        )._id.toString();
        expectedMin += 1;
      }
      if (floor && !wardenTarget) {
        // Sparse DB: every candidate is already a fixture subject — the
        // warden-tap assertions below skip instead of failing
        skip(
          "staff check-in fixtures (no disjoint warden target on this DB)"
        );
      } else {
        check(
          "staff check-in fixtures (roster = checked-in only)",
          !!plainFixtureId && !!targetFixtureId,
          `plain=${!!plainFixtureId} target=${!!targetFixtureId}`
        );
      }

      /* State-1 subject: a NON-activator with no open check-in. One $nin —
         two separate `_id` spreads would silently overwrite each other. */
      const excludedIds = [
        plainUser?._id.toString(),
        wardenTarget?._id.toString(),
      ].filter((id): id is string => !!id);
      const noShowUser = await User.findOne({
        status: "active",
        role: { $in: ["unit_head", "dept_head", "user"] },
        ...(excludedIds.length ? { _id: { $nin: excludedIds } } : {}),
      }).lean();
      const noShowCheckedIn = noShowUser
        ? await Attendance.exists({
            userId: noShowUser._id,
            type: "employee",
            checkedOutAt: null,
          })
        : true;

      /* start */
      const started = await call("/api/evacuation", "POST", evacCookie, {});
      check("evacuation start -> 201", started.status === 201, `${started.status}`);
      const startedSession = started.body.session as
        | { _id?: string; counts?: { total?: number } }
        | undefined;
      createdId = startedSession?._id ?? null;
      check(
        "roster snapshot = everyone checked in at the alarm",
        (startedSession?.counts?.total ?? -1) >= expectedMin,
        `total=${startedSession?.counts?.total} expected>=${expectedMin}`
      );

      const dupStart = await call("/api/evacuation", "POST", evacCookie, {});
      check(
        "second start while active -> 409 (one active session)",
        dupStart.status === 409,
        `${dupStart.status}`
      );

      // Public status must reflect LIVE state (this route is force-dynamic;
      // a prerendered build would freeze it at false forever)
      const statusWhileActive = await fetch(
        `${BASE}/api/evacuation/status`
      ).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
      check(
        "public status reports active=true during a session",
        statusWhileActive.status === 200 &&
          (statusWhileActive.body as { active?: boolean }).active === true,
        `status=${statusWhileActive.status} active=${(statusWhileActive.body as { active?: boolean }).active}`
      );

      // Roster names in the payload must never be cacheable by a proxy
      const rosterFetch = await fetch(
        `${BASE}/api/evacuation?roster=1`,
        { headers: { cookie: evacCookie } }
      );
      const cacheControl = rosterFetch.headers.get("cache-control") ?? "";
      await rosterFetch.arrayBuffer();
      check(
        "roster payload is Cache-Control: private, no-store",
        cacheControl.includes("private") && cacheControl.includes("no-store"),
        cacheControl || "no header"
      );

      /* The takeover is SSR'd from the server layout (no flash of the shell).
         The ADMIN is an activator WITHOUT a check-in → the STATS view with
         NO confirm button: the four roles manage the incident straight from
         the display even if they never scanned in. */
      const takeover = await fetch(`${BASE}/dashboard`, {
        headers: { cookie: evacCookie },
      }).then((r) => r.text());
      check(
        "active session: app SSRs the full-screen takeover (no shell)",
        takeover.includes(strings.evacSessionActive) &&
          !takeover.includes('id="main-content"'),
        `${takeover.length} bytes`
      );
      check(
        "activators see the stats without a check-in (no confirm button)",
        takeover.includes(strings.evacMissing) &&
          takeover.includes(strings.evacExpected) &&
          !takeover.includes(strings.evacImSafe) &&
          !takeover.includes(strings.evacNotInRoster),
        `${takeover.length} bytes`
      );
      check(
        "takeover offers a login/account-switch escape",
        takeover.includes('href="/login"'),
        ""
      );

      /* A NON-activator with no check-in → the informational page */
      if (noShowUser && !noShowCheckedIn) {
        const noShowHtml = await fetch(`${BASE}/dashboard`, {
          headers: { cookie: await mintCookie(noShowUser) },
        }).then((r) => r.text());
        check(
          "staff WITHOUT a check-in gets the in-progress page (no button, no stats)",
          noShowHtml.includes(strings.evacNotInRoster) &&
            !noShowHtml.includes(strings.evacImSafe) &&
            !noShowHtml.includes(strings.evacMissing),
          `${noShowHtml.length} bytes`
        );
      } else {
        skip(
          "in-progress page (no non-activator without a check-in available)"
        );
      }

      /* plain user: light projection, roster privacy, gate, self-confirm */
      if (plainUser) {
        const plainCookie = await mintCookie(plainUser);

        const light = await authed("/api/evacuation", plainCookie);
        const lightSession = light.body.session as
          | {
              mine?: { inRoster?: boolean; confirmedAt?: string | null };
              roster?: unknown;
            }
          | undefined;
        check(
          "plain user sees the active session + own roster status",
          !!lightSession && lightSession.mine?.inRoster === true,
          JSON.stringify(lightSession?.mine ?? null)
        );

        // Checked in + not yet confirmed → state 2: the giant button, no stats
        const gateHtml = await fetch(`${BASE}/dashboard`, {
          headers: { cookie: plainCookie },
        }).then((r) => r.text());
        check(
          "checked-in staff gets the 'Saya Selamat' gate (no stats yet)",
          gateHtml.includes(strings.evacImSafe) &&
            !gateHtml.includes(strings.evacMissing),
          `${gateHtml.length} bytes`
        );
        check(
          "light payload carries no roster",
          !!lightSession && !("roster" in lightSession),
          JSON.stringify(Object.keys(lightSession ?? {}))
        );

        const rosterReq = await authed("/api/evacuation?roster=1", plainCookie);
        const plainRoster = rosterReq.body.session as
          | { rosterVisible?: boolean; roster?: unknown; floors?: unknown }
          | undefined;
        check(
          "plain user cannot see names",
          plainRoster?.rosterVisible === false &&
            !("roster" in (plainRoster ?? {})),
          `visible=${plainRoster?.rosterVisible}`
        );
        check(
          "plain user still gets scoped floor locations",
          Array.isArray(plainRoster?.floors),
          `floors=${typeof plainRoster?.floors}`
        );

        const adminRosterReq = await authed("/api/evacuation?roster=1");
        const adminSession = adminRosterReq.body.session as
          | {
              rosterVisible?: boolean;
              roster?: Array<{ _id: string; confirmedAt: string | null }>;
              floors?: unknown;
            }
          | undefined;
        check(
          "admin sees the full roster",
          adminSession?.rosterVisible === true &&
            Array.isArray(adminSession.roster) &&
            adminSession.roster.length >= 1,
          `rows=${adminSession?.roster?.length}`
        );
        check(
          "admin sees floor location stats",
          Array.isArray(adminSession?.floors),
          `floors=${typeof adminSession?.floors}`
        );

        /* visitors confirm through the PUBLIC endpoint — no auth, no stats */
        if (visitorCheckin?.attendance?._id) {
          const v1 = await fetch(`${BASE}/api/evacuation/visitor-confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: evacVisitorPhone }),
          }).then(async (r) => ({
            status: r.status,
            body: (await r.json().catch(() => ({}))) as Record<string, unknown>,
          }));
          check(
            "visitor 'saya selamat' by phone (no auth) -> 200",
            v1.status === 200,
            `${v1.status}`
          );
          check(
            "visitor response carries NO statistics",
            !("counts" in v1.body) &&
              !("floors" in v1.body) &&
              !("roster" in v1.body),
            JSON.stringify(Object.keys(v1.body))
          );
          check(
            "visitor response names their own floor",
            typeof v1.body.floorName === "string" &&
              (v1.body.floorName as string).length > 0,
            String(v1.body.floorName)
          );

          /* same device, via its check-out token — idempotent second tap */
          const v2 = await fetch(`${BASE}/api/evacuation/visitor-confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attendanceId: visitorCheckin.attendance._id,
              token: visitorCheckin.checkoutToken,
            }),
          }).then((r) => r.status);
          check(
            "visitor confirm by device token -> 200 (idempotent)",
            v2 === 200,
            `${v2}`
          );

          const countsAfter = await authed("/api/evacuation");
          const confirmedCount =
            (
              countsAfter.body.session as {
                counts?: { confirmed?: number };
              } | null
            )?.counts?.confirmed ?? 0;
          check(
            "visitor confirmation counted in totals",
            confirmedCount >= 1,
            `confirmed=${confirmedCount}`
          );
        } else {
          skip("visitor confirm sub-flow (no visitor fixture)");
        }

        /* self-confirm (idempotent) */
        const confirm = await call(
          "/api/evacuation/confirm",
          "POST",
          plainCookie,
          {}
        );
        check(
          "self-confirm -> 200 with a timestamp",
          confirm.status === 200 &&
            typeof (confirm.body as { confirmedAt?: string }).confirmedAt ===
              "string",
          `${confirm.status}`
        );

        const after = await authed("/api/evacuation", plainCookie);
        const afterSession = after.body.session as
          | {
              counts?: { confirmed?: number };
              mine?: { confirmedAt?: string | null };
            }
          | undefined;
        check(
          "confirmation appears in counts + own status",
          !!afterSession?.mine?.confirmedAt &&
            (afterSession.counts?.confirmed ?? 0) >= 1,
          `confirmed=${afterSession?.counts?.confirmed}`
        );

        // …and from now on their SSR shows the stats (the gate has lifted)
        const takeoverConfirmed = await fetch(`${BASE}/dashboard`, {
          headers: { cookie: plainCookie },
        }).then((r) => r.text());
        check(
          "confirmed user's SSR shows the evacuation stats",
          takeoverConfirmed.includes("Dijangka"),
          `${takeoverConfirmed.length} bytes`
        );

        /* plain user may neither confirm others nor start a session */
        const firstRow = adminSession?.roster?.[0];
        if (firstRow) {
          const asOther = await call(
            "/api/evacuation/confirm",
            "PATCH",
            plainCookie,
            { rosterId: firstRow._id, confirm: true }
          );
          check(
            "plain user cannot confirm others (403)",
            asOther.status === 403,
            `${asOther.status}`
          );
        } else {
          check("confirm-others target found", false, "empty roster");
        }

        const startAsPlain = await call(
          "/api/evacuation",
          "POST",
          plainCookie,
          {}
        );
        check(
          "plain user cannot start a session (403)",
          startAsPlain.status === 403,
          `${startAsPlain.status}`
        );
      } else {
        skip("plain-user evacuation sub-flow (no active role=user)");
      }

      /* superadmin: hidden control account — invisible in listings, off the
         roster, and it can never acquire a presence record */
      const superadminAccount = await User.findOne({
        role: "superadmin",
      }).lean();
      const saRoster = await authed("/api/evacuation?roster=1", evacCookie);
      const saRosterSession = saRoster.body.session as
        | { roster?: Array<{ name?: string }> }
        | undefined;
      if (superadminAccount) {
        check(
          "superadmin is not on the evacuation roster",
          !(saRosterSession?.roster ?? []).some(
            (row) => row.name === superadminAccount.name
          ),
          `name=${superadminAccount.name}`
        );
      } else {
        skip("superadmin roster exclusion (no superadmin account)");
      }

      if (superadminAccount && superadminAccount.status === "active" && floor) {
        const saCookie = await mintCookie(superadminAccount);
        const qrBlocked = await fetch(`${BASE}/api/attendance/checkin`, {
          method: "POST",
          headers: { cookie: saCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ qrToken: floor.qrToken }),
        }).then((r) => r.status);
        check(
          "superadmin QR self check-in blocked (403)",
          qrBlocked === 403,
          `${qrBlocked}`
        );

        const manualActor = await User.findOne({
          role: { $in: ["superadmin", "admin"] },
          status: "active",
        }).lean();
        if (manualActor) {
          const manualBlocked = await fetch(
            `${BASE}/api/attendance/checkin`,
            {
              method: "POST",
              headers: {
                cookie: await mintCookie(manualActor),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                method: "manual",
                userId: superadminAccount._id.toString(),
                floorId: floor._id.toString(),
              }),
            }
          ).then((r) => r.status);
          check(
            "manual check-in targeting superadmin blocked (403)",
            manualBlocked === 403,
            `${manualBlocked}`
          );
        } else {
          skip("manual check-in block (no active admin actor)");
        }
      } else {
        skip(
          "superadmin check-in blocks (no active superadmin or no floor)"
        );
      }

      /* A visitor-URL poster whose floor token was ROTATED: the staff
         scanner passes the floor the URL names, so the reply must use the
         rotated-poster wording — and without that hint it stays generic */
      {
        const staleScanner = await User.findOne({
          role: { $ne: "superadmin" },
          status: "active",
        }).lean();
        const staleFloor = await Floor.create({
          name: `E2E QR Rotasi ${Date.now()}`,
          hue: 0,
          createdBy: actor._id,
        });
        const oldToken = staleFloor.qrToken;
        try {
          const rotated = await fetch(`${BASE}/api/floors/${staleFloor._id}`, {
            method: "PATCH",
            headers: { cookie, "Content-Type": "application/json" },
          }).then((r) => r.status);

          if (rotated === 200 && staleScanner) {
            const scannerCookie = await mintCookie(staleScanner);
            const withHint = await fetch(`${BASE}/api/attendance/checkin`, {
              method: "POST",
              headers: { cookie: scannerCookie, "Content-Type": "application/json" },
              body: JSON.stringify({
                qrToken: oldToken,
                scannedFloorId: staleFloor._id.toString(),
              }),
            });
            const withHintBody = await withHint.json().catch(() => ({}));
            check(
              "rotated visitor poster -> rotated wording (400)",
              withHint.status === 400 && withHintBody.error === strings.qrRotated,
              `${withHint.status} ${withHintBody.error}`
            );

            const noHint = await fetch(`${BASE}/api/attendance/checkin`, {
              method: "POST",
              headers: { cookie: scannerCookie, "Content-Type": "application/json" },
              body: JSON.stringify({ qrToken: oldToken }),
            });
            const noHintBody = await noHint.json().catch(() => ({}));
            check(
              "rotated token without floor hint -> generic message (400)",
              noHint.status === 400 &&
                noHintBody.error === strings.invalidQrCode,
              `${noHint.status} ${noHintBody.error}`
            );

            // A hand-made URL naming the floor but carrying a token the
            // floor NEVER used must stay the generic message — only a
            // real previous token earns the rotated wording
            const fabricated = await fetch(`${BASE}/api/attendance/checkin`, {
              method: "POST",
              headers: { cookie: scannerCookie, "Content-Type": "application/json" },
              body: JSON.stringify({
                qrToken: "never-a-real-token-000",
                scannedFloorId: staleFloor._id.toString(),
              }),
            });
            const fabricatedBody = await fabricated.json().catch(() => ({}));
            check(
              "fabricated floor URL -> generic message (400)",
              fabricated.status === 400 &&
                fabricatedBody.error === strings.invalidQrCode,
              `${fabricated.status} ${fabricatedBody.error}`
            );
          } else {
            skip(
              `stale-poster checks (rotate=${rotated}, scanner=${staleScanner ? "yes" : "no"})`
            );
          }
        } finally {
          // Runs on every path — a thrown .json() above must not leak the
          // fixture floor onto the live board until the next sweep
          await Floor.findByIdAndDelete(staleFloor._id);
        }
      }

      /* floor_head: sees only their own floor's names, and may not confirm
         a roster entry on another floor */
      const floorHead = await User.findOne({
        role: "floor_head",
        status: "active",
      }).lean();
      if (floorHead) {
        const Unit = (await import("@/lib/db/models/Unit")).default;
        const unit = floorHead.unitId
          ? await Unit.findById(floorHead.unitId).select("homeFloorId").lean()
          : null;
        const homeFloor = unit?.homeFloorId?.toString() ?? null;

        const fhCookie = await mintCookie(floorHead);
        const fhReq = await authed("/api/evacuation?roster=1", fhCookie);
        const fhSession = fhReq.body.session as
          | {
              rosterVisible?: boolean;
              roster?: Array<{ _id: string; floorId: string | null }>;
            }
          | undefined;
        const fhRows = fhSession?.roster ?? [];
        check(
          "floor_head roster visibility matches their home floor",
          homeFloor
            ? fhSession?.rosterVisible === true &&
                fhRows.length > 0 &&
                fhRows.every((row) => row.floorId === homeFloor)
            : fhSession?.rosterVisible === false,
          `visible=${fhSession?.rosterVisible} rows=${fhRows.length} home=${homeFloor}`
        );

        if (homeFloor) {
          const allReq = await authed("/api/evacuation?roster=1", evacCookie);
          const allRows =
            (
              allReq.body.session as
                | { roster?: Array<{ _id: string; floorId: string | null }> }
                | undefined
            )?.roster ?? [];
          const crossFloor = allRows.find(
            (row) => row.floorId && row.floorId !== homeFloor
          );
          if (crossFloor) {
            const cross = await call(
              "/api/evacuation/confirm",
              "PATCH",
              fhCookie,
              { rosterId: crossFloor._id, confirm: true }
            );
            check(
              "floor_head cannot confirm another floor (403)",
              cross.status === 403,
              `${cross.status}`
            );
          } else {
            check(
              "cross-floor confirm target found",
              false,
              "roster only covers one floor"
            );
          }
        }
      } else {
        skip("floor_head evacuation sub-flow (no active floor_head)");
      }

      /* warden tap: mark someone safe, then correct it back (state restored) */
      const rosterAgain = await authed("/api/evacuation?roster=1");
      const rows =
        (
          rosterAgain.body.session as
            | { roster?: Array<{ _id: string; confirmedAt: string | null }> }
            | undefined
        )?.roster ?? [];
      const target = rows.find((row) => !row.confirmedAt);
      if (target) {
        const mark = await call("/api/evacuation/confirm", "PATCH", evacCookie, {
          rosterId: target._id,
          confirm: true,
        });
        check(
          "warden marks another safe -> 200",
          mark.status === 200,
          `${mark.status}`
        );
        const unmark = await call(
          "/api/evacuation/confirm",
          "PATCH",
          evacCookie,
          { rosterId: target._id, confirm: false }
        );
        check(
          "warden can correct a mark (unconfirm) -> 200",
          unmark.status === 200,
          `${unmark.status}`
        );
      } else if (!targetFixtureId) {
        skip("warden tap (no disjoint target fixture on this DB)");
      } else {
        check("warden tap target found", false, "roster fully confirmed");
      }

      /* close → frozen summary → late confirm rejected */
      const closed = await call("/api/evacuation", "PATCH", evacCookie, {});
      check(
        "close -> 200 with final counts",
        closed.status === 200 &&
          typeof (closed.body as { counts?: { total?: number } }).counts
            ?.total === "number",
        `${closed.status}`
      );

      const statusAfterClose = await fetch(`${BASE}/api/evacuation/status`).then(
        (r) => r.json() as Promise<{ active?: boolean }>
      );
      check(
        "public status reports active=false after close",
        statusAfterClose.active === false,
        `active=${statusAfterClose.active}`
      );

      const afterClose = await authed("/api/evacuation?closed=1");
      check(
        "no active session after close",
        afterClose.body.session === null,
        JSON.stringify(
          afterClose.body.session ? Object.keys(afterClose.body.session) : null
        )
      );
      const lastClosed = afterClose.body.lastClosed as
        | { closedAt?: string; counts?: { total?: number } }
        | null
        | undefined;
      check(
        "last-closed summary matches the session we just closed",
        !!lastClosed &&
          typeof lastClosed.counts?.total === "number" &&
          lastClosed.closedAt === (closed.body as { closedAt?: string }).closedAt,
        `closedAt=${lastClosed?.closedAt}`
      );

      /* after-action reports: history + detail (evacuation:view_report) */
      const histAdmin = await authed("/api/evacuation?history=1");
      const history = histAdmin.body.history as
        | Array<{ _id: string; counts: { total: number; confirmed: number } }>
        | undefined;
      check(
        "report history contains OUR session first (newest-first proven)",
        Array.isArray(history) &&
          history.length >= 1 &&
          history[0]?._id === createdId &&
          typeof history[0]?.counts?.total === "number",
        `first=${history?.[0]?._id} expected=${createdId}`
      );

      if (plainUser) {
        const histPlain = await authed(
          "/api/evacuation?history=1",
          await mintCookie(plainUser)
        );
        check(
          "plain user gets no report history key",
          !("history" in histPlain.body),
          JSON.stringify(Object.keys(histPlain.body))
        );
      }

      if (createdId) {
        const detail = await authed(`/api/evacuation/${createdId}`);
        const detailSession = detail.body.session as
          | { closedAt?: string; roster?: unknown[]; floors?: unknown[] }
          | undefined;
        check(
          "report detail -> 200 with roster + floors + close time",
          detail.status === 200 &&
            typeof detailSession?.closedAt === "string" &&
            Array.isArray(detailSession.roster) &&
            Array.isArray(detailSession.floors),
          `${detail.status}`
        );

        if (plainUser) {
          const detailPlain = await authed(
            `/api/evacuation/${createdId}`,
            await mintCookie(plainUser)
          );
          check(
            "plain user cannot open a report (403)",
            detailPlain.status === 403,
            `${detailPlain.status}`
          );
        }

        const unknownId = await authed(
          "/api/evacuation/64f000000000000000000000"
        );
        check(
          "report detail of unknown id -> 404",
          unknownId.status === 404,
          `${unknownId.status}`
        );
        const malformedId = await authed("/api/evacuation/not-an-object-id");
        check(
          "report detail of malformed id -> 404",
          malformedId.status === 404,
          `${malformedId.status}`
        );

        const emptyWardenPatch = await call(
          "/api/evacuation/confirm",
          "PATCH",
          evacCookie,
          {}
        );
        check(
          "confirm PATCH with empty payload -> 400",
          emptyWardenPatch.status === 400,
          `${emptyWardenPatch.status}`
        );
        const emptyVisitorPost = await fetch(
          `${BASE}/api/evacuation/visitor-confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          }
        ).then((r) => r.status);
        check(
          "visitor-confirm with empty payload -> 400",
          emptyVisitorPost === 400,
          `${emptyVisitorPost}`
        );

        const auditActions = (
          await AuditLog.find({ targetId: createdId }).lean()
        ).map((row) => row.action);
        check(
          "audit: evacuation_start recorded",
          auditActions.includes("evacuation_start"),
          JSON.stringify(auditActions)
        );
        check(
          "audit: evacuation_close recorded",
          auditActions.includes("evacuation_close"),
          ""
        );
        check(
          "audit: warden confirm recorded",
          auditActions.includes("evacuation_confirm_other"),
          ""
        );
      }

      if (plainUser) {
        const late = await call(
          "/api/evacuation/confirm",
          "POST",
          await mintCookie(plainUser),
          {}
        );
        check("confirm after close -> 409", late.status === 409, `${late.status}`);
      }
      if (visitorCheckin?.attendance?._id) {
        const lateVisitor = await fetch(
          `${BASE}/api/evacuation/visitor-confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: evacVisitorPhone }),
          }
        ).then((r) => r.status);
        check(
          "visitor confirm after close -> 409",
          lateVisitor === 409,
          `${lateVisitor}`
        );
      }
    } finally {
      // Independent cleanup steps: one failure must not block the others,
      // and the audit rows pointing at this test session go too
      if (createdId) {
        try {
          await Evacuation.deleteOne({ _id: createdId });
        } catch (cleanupError) {
          console.error("cleanup: evacuation delete failed:", cleanupError);
        }
        try {
          await AuditLog.deleteMany({ targetId: createdId });
        } catch (cleanupError) {
          console.error("cleanup: audit delete failed:", cleanupError);
        }
      }
      try {
        await Attendance.deleteMany({ visitorPhone: evacVisitorPhone });
      } catch (cleanupError) {
        console.error("cleanup: visitor delete failed:", cleanupError);
      }
      const staffFixtureIds = [plainFixtureId, targetFixtureId].filter(
        (id): id is string => !!id
      );
      if (staffFixtureIds.length) {
        try {
          await Attendance.deleteMany({ _id: { $in: staffFixtureIds } });
        } catch (cleanupError) {
          console.error("cleanup: staff fixture delete failed:", cleanupError);
        }
      }
      // Reopen the REAL check-ins the fixtures temporarily closed — those
      // people were only closed to seat the roster fixtures, and the live
      // board should show them as present again
      if (closedByFixture.length) {
        try {
          await Attendance.updateMany(
            { _id: { $in: closedByFixture } },
            { $set: { checkedOutAt: null }, $unset: { checkedOutBy: "" } }
          );
        } catch (cleanupError) {
          console.error("cleanup: fixture reopen failed:", cleanupError);
        }
      }
    }
  }

  console.log("");
  let failed = 0;
  let skipped = 0;
  for (const [name, outcome, detail] of results) {
    const suffix = detail ? `  (${detail})` : "";
    if (outcome === "skip") {
      skipped += 1;
      console.log(`SKIP  ${name}${suffix}`);
    } else if (!outcome) {
      failed += 1;
      console.log(`FAIL  ${name}${suffix}`);
    } else {
      console.log(`PASS  ${name}${suffix}`);
    }
  }
  const passed = results.length - failed - skipped;
  console.log(
    `\n${passed}/${results.length} passed${skipped > 0 ? ` (${skipped} skipped)` : ""}`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("CHECK FAILED:", error);
  process.exit(1);
});
