/**
 * End-to-end check of the visitor duplicate/check-out rules.
 * Creates a throwaway visitor record on a real floor, asserts every rule,
 * then deletes anything it created — the database is left unchanged.
 *
 * Usage: npm run dev (in another shell), then: npx tsx scripts/visitor-check.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const results: Array<[string, boolean, string]> = [];

function check(name: string, ok: boolean, detail = "") {
  results.push([name, ok, detail]);
}

async function post(path: string, body: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

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
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }

  const { connectDB } = await import("@/lib/db/mongoose");
  const Floor = (await import("@/lib/db/models/Floor")).default;
  const Attendance = (await import("@/lib/db/models/Attendance")).default;
  const { normalizeVisitorPhone } = await import("@/lib/validation/schemas");
  const { strings } = await import("@/lib/i18n/strings");

  await connectDB();

  const floors = await Floor.find().sort({ name: 1 }).lean();
  if (floors.length === 0) throw new Error("no floors in the database");
  const [floorA, floorB] = floors;

  // Unique, valid Malaysian numbers: "+60 19xxxxxxx" and "019-xxx xxxx"
  // must normalise to the SAME identity — that equivalence is the point.
  const suffix = String(Date.now()).slice(-7);
  const local = `019${suffix}`;
  const intl = `+60 19${suffix}`;
  const formatted = `${local.slice(0, 3)}-${local.slice(3, 6)} ${local.slice(6)}`;
  const normalized = normalizeVisitorPhone(intl);

  check(
    "normalisation: +60 form === local form",
    normalized === local && normalizeVisitorPhone(formatted) === local,
    `${intl} -> ${normalized}`
  );

  let createdId: string | null = null;
  let checkoutToken = "";

  try {
    // 1. First check-in succeeds and returns a per-attendance token
    const first = await post("/api/visitor/checkin", {
      visitorName: "E2E Visitor",
      visitorPhone: intl,
      floorId: floorA._id.toString(),
      token: floorA.qrToken,
    });
    check("first check-in -> 201", first.status === 201, `got ${first.status}`);
    checkoutToken = first.data?.checkoutToken ?? "";
    createdId = first.data?.attendance?._id ?? null;
    check("check-in returns checkoutToken", checkoutToken.length === 64, `${checkoutToken.length} chars`);

    const stored = createdId ? await Attendance.findById(createdId).lean() : null;
    check("visitorPhone stored normalised", stored?.visitorPhone === local, stored?.visitorPhone ?? "record missing");

    // 2. Same visitor, same floor, same person typed differently -> blocked
    const dupSame = await post("/api/visitor/checkin", {
      visitorName: "E2E Visitor",
      visitorPhone: formatted,
      floorId: floorA._id.toString(),
      token: floorA.qrToken,
    });
    check("duplicate on same floor -> 409", dupSame.status === 409, `got ${dupSame.status}`);
    check("409 marks alreadyCheckedIn", dupSame.data?.alreadyCheckedIn === true);
    check(
      "409 does NOT mint a checkout token",
      dupSame.data?.checkoutToken === undefined,
      JSON.stringify(dupSame.data?.checkoutToken ?? null)
    );
    check(
      "409 does not leak the stored visitor name",
      dupSame.data?.attendance?.visitorName === undefined,
      JSON.stringify(dupSame.data?.attendance ?? null)
    );
    check(
      "409 uses the same-floor message",
      dupSame.data?.error === strings.visitorAlreadyOnThisFloor,
      dupSame.data?.error ?? ""
    );

    // 3. Same visitor on a DIFFERENT floor -> still blocked (one place only)
    if (floorB) {
      const dupOther = await post("/api/visitor/checkin", {
        visitorName: "E2E Visitor",
        visitorPhone: local,
        floorId: floorB._id.toString(),
        token: floorB.qrToken,
      });
      check("duplicate on another floor -> 409", dupOther.status === 409, `got ${dupOther.status}`);
      check(
        "409 names the ORIGINAL floor",
        typeof dupOther.data?.error === "string" && dupOther.data.error.includes(floorA.name),
        dupOther.data?.error ?? ""
      );
      const rows = await Attendance.countDocuments({ visitorPhone: local, checkedOutAt: null });
      check("only ONE open record exists", rows === 1, `${rows} open records`);
    }

    // 4. The printed floor token must NOT be able to check out anymore (D)
    const withFloorToken = await post("/api/visitor/checkout", {
      attendanceId: createdId,
      checkoutToken: floorA.qrToken,
    });
    check("floor qrToken rejected for checkout -> 403", withFloorToken.status === 403, `got ${withFloorToken.status}`);

    // 5. Missing checkoutToken -> rejected
    const noToken = await post("/api/visitor/checkout", { attendanceId: createdId });
    check("missing checkoutToken rejected", noToken.status === 400, `got ${noToken.status}`);

    // 6. The real token works
    const out = await post("/api/visitor/checkout", {
      attendanceId: createdId,
      checkoutToken,
    });
    check("valid checkoutToken -> 200", out.status === 200, `got ${out.status}`);

    // 7. Second checkout -> already out (and no duplicate check-in afterwards)
    const twice = await post("/api/visitor/checkout", {
      attendanceId: createdId,
      checkoutToken,
    });
    check("second checkout -> 400", twice.status === 400, `got ${twice.status}`);

    const again = await post("/api/visitor/checkin", {
      visitorName: "E2E Visitor",
      visitorPhone: local,
      floorId: floorA._id.toString(),
      token: floorA.qrToken,
    });
    check("re-check-in after checkout -> 201", again.status === 201, `got ${again.status}`);
    if (again.status === 201) createdId = again.data?.attendance?._id ?? createdId;
  } finally {
    // Leave the database exactly as we found it
    const removed = await Attendance.deleteMany({ visitorPhone: local });
    console.log(`\ncleanup: removed ${removed.deletedCount} test record(s)`);
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
