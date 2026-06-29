// build/generate-images.ts
// Generates apple-touch-icon.png (180×180) and og-default.png (1200×630)
// from the SVG favicon design.

import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { siteName, accent } from "./site.config.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST_DIR = join(__dirname, "../dist");

// X-Files / dossier palette: terminal green on near-black with a redaction bar.
const ACCENT = accent;        // terminal green
const TEXT_COLOR = "#e8f5e9"; // near-white phosphor
const BG = "#0a0a0a";
const PANEL = "#141414";
const MONO = "ui-monospace, 'Cascadia Code', 'Fira Code', monospace";

function touchIconSvg(): Buffer {
  // Dark tile, green border, a black "redaction" bar across a phosphor "M".
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="34" fill="${BG}"/>
  <rect x="6" y="6" width="168" height="168" rx="30" fill="none" stroke="${ACCENT}" stroke-width="6"/>
  <text x="90" y="128" font-family="${MONO}" font-size="104" font-weight="700"
        text-anchor="middle" fill="${ACCENT}">M</text>
  <rect x="34" y="86" width="112" height="20" fill="${BG}" opacity="0.0"/>
</svg>`;
  return Buffer.from(svg);
}

function ogImageSvg(): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="40" y="40" width="1120" height="550" rx="16" fill="${PANEL}" stroke="${ACCENT}" stroke-width="2"/>
  <text x="80" y="200" font-family="${MONO}" font-size="26" letter-spacing="6"
        fill="${ACCENT}">CASE FILE // OPEN</text>
  <text x="80" y="300" font-family="${MONO}" font-size="74" font-weight="700"
        fill="${TEXT_COLOR}">${siteName}</text>
  <rect x="80" y="340" width="520" height="40" fill="${TEXT_COLOR}" opacity="0.85"/>
  <text x="80" y="470" font-family="${MONO}" font-size="24"
        fill="#9aa">Deaths &amp; disappearances of U.S. defense scientists</text>
  <text x="80" y="520" font-family="${MONO}" font-size="20"
        fill="#667">AI-assisted research dossier &#183; public sources only</text>
</svg>`;
  return Buffer.from(svg);
}

export async function generateImages(): Promise<void> {
  // apple-touch-icon.png → dist root
  const touchIconPath = join(DIST_DIR, "apple-touch-icon.png");
  try {
    await stat(touchIconPath);
    console.log("[images] apple-touch-icon.png already exists — skipping");
  } catch {
    await mkdir(DIST_DIR, { recursive: true });
    const png = await sharp(touchIconSvg()).png().toBuffer();
    await writeFile(touchIconPath, png);
    console.log("[images] wrote apple-touch-icon.png (180×180)");
  }

  // og-default.png → dist/assets/images/
  const ogDir = join(DIST_DIR, "assets/images");
  const ogPath = join(ogDir, "og-default.png");
  try {
    await stat(ogPath);
    console.log("[images] og-default.png already exists — skipping");
  } catch {
    await mkdir(ogDir, { recursive: true });
    const png = await sharp(ogImageSvg()).png().toBuffer();
    await writeFile(ogPath, png);
    console.log("[images] wrote og-default.png (1200×630)");
  }
}
