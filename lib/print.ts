/**
 * Branded print documents for the physical QR posters (per-floor check-in
 * posters and the notice-board app poster).
 *
 * Layout: FOUR identical quarter-A4 cards (roughly A6) per A4 sheet, each
 * inside a dashed CUT FRAME — print once, cut along the dashes, paste one
 * per door. Everything is built with DOM APIs and textContent — never
 * string-interpolated HTML: a floor name containing markup must print as
 * text, not execute.
 *
 * Each card carries the app's visual identity: the accent bar (the floor's
 * identity colour on floor posters, brand blue on the app poster), the
 * "EasyHC - Easy Head Count" wordmark, and the issuing organisation — so a
 * cut-out that ends up on a physical door still says whose it is.
 */
import { strings } from "@/lib/i18n/strings";
import { clock } from "@/lib/format";

/** Brand blue — the primary used across the app (theme brandPrimary). */
export const BRAND_BLUE = "#1d4ed8";

const PAGE_CSS = `
  @page { size: A4; margin: 8mm; }
  body {
    margin: 0; color: #111;
    font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  /* 2x2 grid of quarter-A4 cards; the dashed border IS the cut frame */
  .cut-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .cut-card {
    border: 1.5pt dashed #999; border-radius: 2mm;
    padding: 0 5mm 3mm; overflow: hidden; text-align: center;
  }
  .cut-bar {
    height: 3mm; margin: 0 -5mm;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .cut-brand { font-size: 11pt; font-weight: 800; letter-spacing: -0.01em; margin: 3mm 0 0; }
  .cut-tagline { font-size: 6pt; letter-spacing: 0.25em; text-transform: uppercase; color: #666; margin: 0.5mm 0 0; }
  .cut-title { font-size: 14pt; font-weight: 800; line-height: 1.15; margin: 3mm 0 0; }
  .cut-sub { font-size: 10pt; font-weight: 700; margin: 1.5mm 0 0; }
  .cut-qr { width: 52mm; height: 52mm; display: block; margin: 4mm auto 0; }
  .cut-note { font-size: 7.5pt; color: #555; line-height: 1.35; margin: 3mm 0 0; }
  .cut-url { font-size: 10pt; font-weight: 700; margin: 3mm 0 0; word-break: break-all; }
  .cut-steps { font-size: 8pt; line-height: 1.5; text-align: left; width: 86%; margin: 3mm auto 0; padding-left: 4mm; }
  .cut-org { font-size: 6.5pt; color: #666; margin: 3mm 0 0; }
  .cut-org strong { color: #444; }
`;

export interface PosterSheet {
  doc: Document;
  /** Append `copies` identical cards, each built by `build` */
  fill: (build: (card: HTMLElement) => void) => void;
  /** Print once every QR image across all cards has settled */
  printWhenReady: (imgs: HTMLImageElement[]) => void;
}

/**
 * Open a blank, quarter-A4 poster sheet. Returns null when the popup is
 * blocked — callers should tell the user then.
 */
export function openPoster(
  title: string,
  accent: string,
  copies = 4
): PosterSheet | null {
  const win = window.open("", "_blank");
  if (!win) return null;

  const doc = win.document;
  doc.title = title;
  doc.documentElement.lang = "ms";

  const style = doc.createElement("style");
  style.textContent = PAGE_CSS;
  doc.head.append(style);

  // Wordmark: split from the single brand string in i18n
  const [wordmarkText, taglineText] = strings.appName.split(" - ");

  const grid = doc.createElement("div");
  grid.className = "cut-grid";

  const addCardOnce = (build: (card: HTMLElement) => void) => {
    const card = doc.createElement("div");
    card.className = "cut-card";

    // Accent bar — forced so browsers keep it on paper
    const bar = doc.createElement("div");
    bar.className = "cut-bar";
    bar.style.background = accent;

    const brand = doc.createElement("p");
    brand.className = "cut-brand";
    brand.textContent = wordmarkText || strings.appName;
    brand.style.color = accent;

    const tagline = doc.createElement("p");
    tagline.className = "cut-tagline";
    tagline.textContent = taglineText || "";

    const body = doc.createElement("div");
    build(body);

    // The cut-out must say who it belongs to, and when it was printed
    const org = doc.createElement("p");
    org.className = "cut-org";
    const orgStrong = doc.createElement("strong");
    orgStrong.textContent = strings.appOrg;
    org.append(
      orgStrong,
      doc.createTextNode(
        ` · ${strings.printedOn(clock(new Date().toISOString()))}`
      )
    );

    card.append(bar, brand, tagline, body, org);
    grid.append(card);
  };

  doc.body.append(grid);

  let didPrint = false;
  const printWhenReady = (imgs: HTMLImageElement[]) => {
    if (imgs.length === 0) return; // nothing to print, nothing to wait for
    const doPrint = () => {
      if (didPrint) return;
      didPrint = true;
      win.print();
    };
    let remaining = imgs.length;
    let loaded = 0;
    const settle = (ok: boolean) => {
      if (ok) loaded += 1;
      remaining -= 1;
      // Only a FULLY rendered sheet is worth printing: an errored QR would
      // commit four blank boxes, so the window stays open instead (blank
      // cards are visible and can be retried or printed manually)
      if (remaining <= 0 && loaded === imgs.length) doPrint();
    };
    for (const img of imgs) {
      img.addEventListener("load", () => settle(true));
      img.addEventListener("error", () => settle(false));
    }
    // …and the timeout follows the same rule: a slow endpoint must not
    // commit sheets with empty boxes either
    setTimeout(() => {
      if (
        !didPrint &&
        imgs.every((i) => i.complete && i.naturalWidth > 0)
      ) {
        doPrint();
      }
    }, 3000);
  };

  return {
    doc,
    fill: (build) => {
      for (let i = 0; i < copies; i++) addCardOnce(build);
    },
    printWhenReady,
  };
}
