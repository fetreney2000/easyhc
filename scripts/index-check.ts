/**
 * Verifies the schema's indexes can actually be built — in particular the
 * partial unique index ({type, visitorPhone} over OPEN visitor records),
 * because MongoDB may reject `checkedOutAt: null` in a partialFilterExpression.
 * Read-only apart from index builds (what the app does on boot anyway).
 *
 * Usage: npx tsx scripts/index-check.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

async function main(): Promise<void> {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }

  const { connectDB } = await import("@/lib/db/mongoose");
  const Attendance = (await import("@/lib/db/models/Attendance")).default;

  await connectDB();

  try {
    // Forces every schema index to build (this is what autoIndex does)
    await Attendance.init();
    const indexes = await Attendance.listIndexes();

    const uniqueVisitor = indexes.find(
      (i) => i.name === "type_1_visitorPhone_1"
    );
    console.log("indexes:", indexes.map((i) => i.name).join(", "));
    console.log(
      "\npartial unique index:",
      uniqueVisitor
        ? `unique=${!!uniqueVisitor.unique} filter=${JSON.stringify(
            (uniqueVisitor as { partialFilterExpression?: unknown }).partialFilterExpression
          )}`
        : "MISSING"
    );

    // Confirm the semantics: one open row per phone, closed rows exempt
    const anyOpen = await Attendance.findOne({
      type: "visitor",
      visitorPhone: { $type: "string" },
      checkedOutAt: null,
    }).lean();
    console.log("open visitor record with a phone:", anyOpen ? "exists (locked by index)" : "none yet");
  } catch (error) {
    console.error("INDEX BUILD FAILED:", (error as Error).message);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
