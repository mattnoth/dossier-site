import { readdir, copyFile, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SRC_DIR = join(__dirname, "../src");
const DIST_DIR = join(__dirname, "../dist");

// Layer order for CSS concatenation — must stay in sync with @layer declaration in main.css
const CSS_LAYER_ORDER = [
  "reset.css",
  "tokens.css",
  "typography.css",
  "layout.css",
  "nav.css",
  "components.css",
  "missing-scientists.css",
  "animations.css",
] as const satisfies readonly string[];

async function copyRecursive(src: string, dest: string): Promise<number> {
  let count = 0;
  let entries: string[];
  try {
    entries = await readdir(src);
  } catch {
    // src doesn't exist — skip silently
    return 0;
  }

  await mkdir(dest, { recursive: true });

  for (const entry of entries) {
    if (entry === ".gitkeep") continue;
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const info = await stat(srcPath);
    if (info.isDirectory()) {
      count += await copyRecursive(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
      count++;
    }
  }
  return count;
}

export async function copyAssets(): Promise<void> {
  const assetsSrc = join(SRC_DIR, "assets");
  const assetsDest = join(DIST_DIR, "assets");

  const count = await copyRecursive(assetsSrc, assetsDest);
  if (count > 0) {
    console.log(`[assets] copied ${count} file(s) → dist/assets/`);
  } else {
    console.log("[assets] no assets to copy");
  }

  // Copy root static files if present
  const rootStatics = ["favicon.ico", "robots.txt", "favicon.svg", "apple-touch-icon.png"];
  for (const file of rootStatics) {
    const srcPath = join(SRC_DIR, file);
    try {
      await stat(srcPath);
      await copyFile(srcPath, join(DIST_DIR, file));
      console.log(`[assets] copied ${file} → dist/`);
    } catch {
      // not present — skip
    }
  }
}

export async function concatCss(): Promise<void> {
  const stylesDir = join(SRC_DIR, "styles");
  const outPath = join(DIST_DIR, "main.css");

  await mkdir(DIST_DIR, { recursive: true });

  const parts: string[] = [];

  // main.css first (contains the @layer declaration)
  try {
    const main = await readFile(join(stylesDir, "main.css"), "utf-8");
    const trimmed = main.trim();
    if (trimmed && !trimmed.startsWith("/*")) {
      parts.push(main);
    } else if (trimmed.startsWith("/*")) {
      // Stub comment — skip
    }
  } catch {
    // missing — skip
  }

  // Then partials in layer order
  let skipped = 0;
  for (const filename of CSS_LAYER_ORDER) {
    const filePath = join(stylesDir, filename);
    try {
      const content = await readFile(filePath, "utf-8");
      const trimmed = content.trim();
      if (trimmed && !trimmed.startsWith("/*")) {
        parts.push(content);
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  if (parts.length === 0) {
    console.log("[css] no CSS content found — writing empty dist/main.css");
    await writeFile(outPath, "", "utf-8");
    return;
  }

  if (skipped > 0) {
    console.log(`[css] ${skipped} CSS file(s) were stubs/missing — skipped`);
  }

  await writeFile(outPath, parts.join("\n"), "utf-8");
  console.log(`[css] concatenated ${parts.length} file(s) → dist/main.css`);
}

export async function getWatchedCssFiles(): Promise<string[]> {
  const stylesDir = join(SRC_DIR, "styles");
  return ["main.css", ...CSS_LAYER_ORDER].map((f) => join(stylesDir, f));
}

export { DIST_DIR, SRC_DIR };
