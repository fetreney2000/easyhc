import crypto from "crypto";
import { secureCompare } from "@/lib/api/utils";

/**
 * Per-attendance visitor check-out token.
 *
 * The floor's `qrToken` is printed on the wall, so anything that only checks
 * it can be used by anyone on that floor to close *any* visitor's record.
 * Instead, every successful visitor check-in issues an HMAC scoped to that
 * one record (id + floor + check-in time), and only the device that checked
 * in can present it to check out.
 *
 * Re-checking in produces a different checkedInAt, which invalidates the
 * previously issued token automatically.
 */

function signingKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set — cannot issue visitor tokens");
  }
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export interface VisitorTokenRecord {
  id: string;
  floorId: string;
  checkedInAt: Date | string;
}

export function issueVisitorToken(record: VisitorTokenRecord): string {
  const payload = `${record.id}:${record.floorId}:${new Date(
    record.checkedInAt
  ).getTime()}`;

  return crypto
    .createHmac("sha256", signingKey())
    .update(payload, "utf8")
    .digest("hex");
}

export function verifyVisitorToken(
  token: unknown,
  record: VisitorTokenRecord
): boolean {
  if (typeof token !== "string" || token.length === 0) return false;

  try {
    return secureCompare(token, issueVisitorToken(record));
  } catch {
    return false;
  }
}
