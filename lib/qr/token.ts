import crypto from "crypto";

/**
 * QR payload encryption.
 *
 * Employee QR codes carry the floor's rotating `qrToken`, encrypted so that
 * the printed code is only useful to this deployment. The server validates a
 * scan by decrypting and looking the value up as `qrToken`, which means:
 *
 *  - a raw floor _id is NOT a valid QR payload (IDs are public via /api/floors);
 *  - rotating a floor's qrToken immediately revokes every printed QR.
 *
 * AES-256-GCM (authenticated) with a fresh random IV per encoding: tampered
 * or truncated payloads fail to decrypt instead of decoding to garbage.
 *
 * Payload format: "<iv hex>.<auth tag hex>.<ciphertext hex>"
 */

function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set — cannot process QR tokens");
  }
  // Hash to a fixed 32-byte key regardless of the secret's length/format
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function encryptQrPayload(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(".");
}

export function decryptQrPayload(payload: string): string | null {
  try {
    if (typeof payload !== "string") return null;

    const [ivHex, tagHex, dataHex] = payload.split(".");
    if (!ivHex || !tagHex || !dataHex) return null;
    if (!/^[0-9a-f]+$/i.test(ivHex + tagHex + dataHex)) return null;

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    // Wrong key, tampered payload, malformed input, or missing secret
    return null;
  }
}
