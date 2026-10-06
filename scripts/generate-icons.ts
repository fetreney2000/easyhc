/**
 * Generates the app icons — no image libraries required.
 *
 *   public/icons/icon-192x192.png     manifest + Android
 *   public/icons/icon-512x512.png     manifest + Android
 *   public/icons/maskable-512x512.png maskable (full-bleed, safe-zone glyph)
 *   public/icons/apple-touch-icon.png iOS home screen (180)
 *   public/favicon.ico                PNG-in-ICO (48), understood by browsers
 *
 * A white "person" glyph on the brand blue (#2563eb, the app's theme color),
 * anti-aliased with 4x4 supersampling. Run: npx tsx scripts/generate-icons.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { deflateSync } from "zlib";

const BRAND = [0x25, 0x63, 0xeb] as const; // #2563eb
const WHITE = [0xff, 0xff, 0xff] as const;
const OUT_DIR = resolve(process.cwd(), "public", "icons");

/* ---------------------------------- PNG ---------------------------------- */

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);

  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(size: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // colour type: RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // Raw image: each scanline prefixed with filter byte 0 (None)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* --------------------------------- Glyph --------------------------------- */

/**
 * Normalised glyph (0..1 box): circle head + shoulder ellipse, clipped so the
 * two shapes do not touch. Bounding box ≈ y 0.18 → 1.0.
 */
function insideGlyph(gx: number, gy: number): boolean {
  const hx = gx - 0.5;
  const hy = gy - 0.33;
  if (hx * hx + hy * hy <= 0.15 * 0.15) return true;

  if (gy >= 0.52) {
    const bx = (gx - 0.5) / 0.3;
    const by = (gy - 0.86) / 0.3;
    if (bx * bx + by * by <= 1) return true;
  }
  return false;
}

function renderIcon(size: number, boxFraction: number): Buffer {
  const rgba = Buffer.alloc(size * size * 4);
  const box = size * boxFraction;
  const originX = (size - box) / 2;
  // The glyph's box spans y 0.18..1.0 → shift up so it sits optically centred
  const originY = (size - box) / 2 - box * 0.09;

  const SAMPLES = 4;
  const totalSamples = SAMPLES * SAMPLES;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const px = x + (sx + 0.5) / SAMPLES;
          const py = y + (sy + 0.5) / SAMPLES;
          if (insideGlyph((px - originX) / box, (py - originY) / box)) hits++;
        }
      }

      const coverage = hits / totalSamples;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(BRAND[0] * (1 - coverage) + WHITE[0] * coverage);
      rgba[i + 1] = Math.round(BRAND[1] * (1 - coverage) + WHITE[1] * coverage);
      rgba[i + 2] = Math.round(BRAND[2] * (1 - coverage) + WHITE[2] * coverage);
      rgba[i + 3] = 255;
    }
  }

  return encodePng(size, rgba);
}

/* ---------------------------------- ICO ---------------------------------- */

/** Single-image ICO wrapping a PNG (supported by all current browsers/OSes). */
function encodeIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette colours
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // data size
  entry.writeUInt32LE(header.length + entry.length, 12); // data offset

  return Buffer.concat([header, entry, png]);
}

/* --------------------------------- Output -------------------------------- */

function write(relativePath: string, data: Buffer): void {
  const target = resolve(OUT_DIR, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  console.log(`wrote ${relativePath} (${data.length} bytes)`);
}

write("icon-192x192.png", renderIcon(192, 0.68));
write("icon-512x512.png", renderIcon(512, 0.68));
write("maskable-512x512.png", renderIcon(512, 0.56)); // stays inside the safe zone
write("apple-touch-icon.png", renderIcon(180, 0.68));
writeFileSync(resolve(process.cwd(), "public", "favicon.ico"), encodeIco(renderIcon(48, 0.68), 48));
console.log("wrote ../favicon.ico");
