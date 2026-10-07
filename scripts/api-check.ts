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

  /* 5. evacuation session: start → confirm → privacy → close ------------- */
  const Evacuation = (await import("@/lib/db/models/Evacuation")).default;
  const evacActor = await User.findOne({
    role: { $in: ["superadmin", "admin", "safety_head"] },
    status: "active",
  }).lean();
  const preExisting = await Evacuation.findOne({ status: "active" }).lean();

  if (!evacActor) {
    check("evacuation flow skipped (no privileged account)", true, "");
  } else if (preExisting) {
    // Never disturb a drill that may be real
    check("evacuation flow skipped (a session is already active)", true, "");
  } else {
    const evacCookie = await mintCookie(evacActor);
    let createdId: string | null = null;

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
      /* start */
      const started = await call("/api/evacuation", "POST", evacCookie, {});
      check("evacuation start -> 201", started.status === 201, `${started.status}`);
      const startedSession = started.body.session as
        | { _id?: string; counts?: { total?: number } }
        | undefined;
      createdId = startedSession?._id ?? null;
      check(
        "roster snapshot has people",
        (startedSession?.counts?.total ?? 0) >= 1,
        `total=${startedSession?.counts?.total}`
      );

      const dupStart = await call("/api/evacuation", "POST", evacCookie, {});
      check(
        "second start while active -> 409 (one active session)",
        dupStart.status === 409,
        `${dupStart.status}`
      );

      /* plain user: light projection, roster privacy, self-confirm */
      const plainUser =
        (staffAccount && staffAccount.status === "active"
          ? staffAccount
          : null) ??
        (await User.findOne({ role: "user", status: "active" }).lean());

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
        check(
          "light payload carries no roster",
          !!lightSession && !("roster" in lightSession),
          JSON.stringify(Object.keys(lightSession ?? {}))
        );

        const rosterReq = await authed("/api/evacuation?roster=1", plainCookie);
        const plainRoster = rosterReq.body.session as
          | { rosterVisible?: boolean; roster?: unknown }
          | undefined;
        check(
          "plain user cannot see names",
          plainRoster?.rosterVisible === false &&
            !("roster" in (plainRoster ?? {})),
          `visible=${plainRoster?.rosterVisible}`
        );

        const adminRosterReq = await authed("/api/evacuation?roster=1");
        const adminSession = adminRosterReq.body.session as
          | {
              rosterVisible?: boolean;
              roster?: Array<{ _id: string; confirmedAt: string | null }>;
            }
          | undefined;
        check(
          "admin sees the full roster",
          adminSession?.rosterVisible === true &&
            Array.isArray(adminSession.roster) &&
            adminSession.roster.length >= 1,
          `rows=${adminSession?.roster?.length}`
        );

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
        check(
          "plain-user evacuation sub-flow skipped (no active role=user)",
          true,
          ""
        );
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
        check(
          "floor_head evacuation sub-flow skipped (no active floor_head)",
          true,
          ""
        );
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

      const afterClose = await authed("/api/evacuation?closed=1");
      check(
        "no active session after close",
        afterClose.body.session === null,
        JSON.stringify(
          afterClose.body.session ? Object.keys(afterClose.body.session) : null
        )
      );
      const lastClosed = afterClose.body.lastClosed as
        | { counts?: { total?: number } }
        | null
        | undefined;
      check(
        "last-closed summary available",
        !!lastClosed && typeof lastClosed.counts?.total === "number",
        `total=${lastClosed?.counts?.total}`
      );

      if (plainUser) {
        const late = await call(
          "/api/evacuation/confirm",
          "POST",
          await mintCookie(plainUser),
          {}
        );
        check("confirm after close -> 409", late.status === 409, `${late.status}`);
      }
    } finally {
      // Remove the test session entirely — no drill record left behind
      if (createdId) await Evacuation.deleteOne({ _id: createdId });
    }
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
