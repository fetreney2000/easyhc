/**
 * Branded print documents for the physical QR posters (per-floor check-in
 * posters and the notice-board app poster). Everything is built with DOM
 * APIs and textContent — never string-interpolated HTML: a floor name
 * containing markup must print as text, not execute.
 *
 * The posters carry the app's visual identity: an accent bar (the floor's
 * identity colour on floor posters, brand blue on the app poster), the
 * "EasyHC - Easy Head Count" wordmark, and the issuing organisation in the
 * footer — so a printout that ends up on a wall still says whose it is.
 */
import { strings } from "@/lib/i18n/strings";
import { clock } from "@/lib/format";

/** Brand blue — the primary used across the app (theme brandPrimary). */
export const BRAND_BLUE = "#1d4ed8";

export interface PosterDoc {
  doc: Document;
  /** Append the poster body (title, QR, notes) into this container */
  main: HTMLElement;
  /** Fire print once the QR image has loaded (with error/timeout fallbacks) */
  printWhenReady: (img: HTMLImageElement) => void;
}

/**
 * Open a blank, branded print document. Returns null when the popup is
 * blocked — callers should simply do nothing then.
 */
export function openPoster(
  title: string,
  accent: string
): PosterDoc | null {
  const win = window.open("", "_blank");
  if (!win) return null;

  const doc = win.document;
  doc.title = title;
  doc.documentElement.lang = "ms";

  // Accent bar — forced so browsers keep it on paper
  const bar = doc.createElement("div");
  bar.style.cssText = `height:12px;background:${accent};print-color-adjust:exact;-webkit-print-color-adjust:exact;`;

  // Wordmark: split from the single brand string in i18n
  const [wordmarkText, taglineText] = strings.appName.split(" - ");
  const header = doc.createElement("header");
  header.style.cssText = "text-align:center;padding:28px 40px 0;";
  const wordmark = doc.createElement("p");
  wordmark.textContent = wordmarkText || strings.appName;
  wordmark.style.cssText = `font-size:30px;font-weight:800;letter-spacing:-0.02em;color:${accent};margin:0;`;
  const tagline = doc.createElement("p");
  tagline.textContent = taglineText || "";
  tagline.style.cssText =
    "font-size:13px;letter-spacing:0.25em;text-transform:uppercase;color:#666;margin:2px 0 0;";
  header.append(wordmark, tagline);

  const main = doc.createElement("main");
  main.style.cssText =
    "text-align:center;padding:24px 40px;font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif;";

  // Footer: who issued it, and when this sheet came off the printer
  const footer = doc.createElement("footer");
  footer.style.cssText =
    "text-align:center;padding:20px 40px 36px;color:#666;font-size:13px;";
  const org = doc.createElement("p");
  org.textContent = strings.appOrg;
  org.style.cssText = "font-weight:600;color:#444;margin:0;";
  const printedOn = doc.createElement("p");
  printedOn.textContent = strings.printedOn(clock(new Date().toISOString()));
  printedOn.style.cssText = "margin:2px 0 0;";
  footer.append(org, printedOn);

  doc.body.style.cssText =
    "margin:0;color:#111;font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif;";
  doc.body.append(bar, header, main, footer);

  let didPrint = false;
  const printWhenReady = (img: HTMLImageElement) => {
    const doPrint = () => {
      if (didPrint) return;
      didPrint = true;
      win.print();
    };
    // Print once the QR image has actually loaded (with fallbacks)
    img.addEventListener("load", doPrint);
    img.addEventListener("error", doPrint);
    setTimeout(doPrint, 2500);
  };

  return { doc, main, printWhenReady };
}
