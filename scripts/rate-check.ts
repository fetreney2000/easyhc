/** Usage: npx tsx scripts/rate-check.ts */
async function main(): Promise<void> {
  const { checkRateLimit, resetRateLimit } = await import(
    "@/lib/security/rateLimit"
  );

  const key = "unit-test-key";
  resetRateLimit(key);

  const outcomes: boolean[] = [];
  for (let i = 0; i < 17; i++) {
    outcomes.push(checkRateLimit(key, 15, 60_000).ok);
  }

  const first = outcomes.slice(0, 15).every((ok) => ok);
  const blocked16 = outcomes[15] === false;
  const blocked17 = outcomes[16] === false;
  const retry = checkRateLimit(key, 15, 60_000);

  console.log("first 15 allowed      :", first);
  console.log("16th blocked          :", blocked16);
  console.log("17th blocked          :", blocked17);
  console.log("retryAfterSeconds > 0 :", retry.retryAfterSeconds > 0);
  console.log("reset clears bucket   :", (resetRateLimit(key), checkRateLimit(key, 15, 60_000).ok));

  if (!(first && blocked16 && blocked17 && retry.retryAfterSeconds > 0)) {
    console.log("FAILED");
    process.exit(1);
  }
  console.log("OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
