import { rm, mkdir, readFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { generateMissingScientistsPages } from "./missing-scientists.ts";
import { generateSitemap } from "./sitemap.ts";
import { concatCss, copyAssets, DIST_DIR, SRC_DIR } from "./copy-assets.ts";
import { lintClasses } from "./lint-classes.ts";
import { generateImages } from "./generate-images.ts";
import { clearTemplateCache, setGlobalSlots } from "./templates.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const isDev = process.argv.includes("--dev");

// ── timing util ────────────────────────────────────────────────────────────

function now(): number {
  return performance.now();
}

function ms(start: number): string {
  return `${Math.round(performance.now() - start)}ms`;
}

// ── step runners ────────────────────────────────────────────────────────────

async function stepClean(): Promise<void> {
  const t = now();
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });
  console.log(`[build] clean: ${ms(t)}`);
}

async function stepCss(): Promise<void> {
  const t = now();
  await concatCss();
  console.log(`[build] CSS: ${ms(t)}`);
}

async function stepJs(minify: boolean, sourcemap: boolean): Promise<esbuild.BuildResult> {
  const t = now();
  const entryPoint = join(SRC_DIR, "ts/main.ts");
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: "esm",
    target: "es2022",
    outfile: join(DIST_DIR, "main.js"),
    minify,
    sourcemap,
    logLevel: "silent",
  });
  console.log(`[build] JS: ${ms(t)}`);
  return result;
}

async function stepLintClasses(): Promise<void> {
  const t = now();
  await lintClasses();
  console.log(`[build] lint-classes: ${ms(t)}`);
}

async function stepAssets(): Promise<void> {
  const t = now();
  await copyAssets();
  console.log(`[build] assets: ${ms(t)}`);
}

// ── content hashing ────────────────────────────────────────────────────────
//
// CSS/JS ship under a hash of their own bytes, so a changed file is a changed
// URL. That is what lets netlify.toml cache them immutably for a year without
// stranding visitors on a stale copy: old URL is never requested again.
// Emitting them at a fixed name and calling the fixed name immutable is the bug
// this replaces — see the cache headers in netlify.toml.

/** Rename dist/<file> to dist/<name>.<hash><ext> and return its absolute href. */
async function hashAsset(fileName: string): Promise<string> {
  const bytes = await readFile(join(DIST_DIR, fileName));
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
  const dot = fileName.lastIndexOf(".");
  const hashed = `${fileName.slice(0, dot)}.${hash}${fileName.slice(dot)}`;
  await rename(join(DIST_DIR, fileName), join(DIST_DIR, hashed));
  return `/${hashed}`;
}

// ── production build ─────────────────────────────────────────────────────

async function runBuild(): Promise<void> {
  const total = now();
  console.log("[build] starting production build…");

  await stepClean();

  // CSS/JS first: their content hash becomes the href the pages must reference,
  // so they have to exist before any HTML is rendered.
  await stepCss();
  await stepJs(true, true);
  const [cssHref, jsHref] = await Promise.all([hashAsset("main.css"), hashAsset("main.js")]);
  setGlobalSlots({ css_href: cssHref, js_href: jsHref });
  console.log(`[build] hashed: ${cssHref} ${jsHref}`);

  await generateMissingScientistsPages();
  await stepLintClasses();
  await generateSitemap();
  await stepAssets();
  await generateImages();

  console.log(`[build] done: ${ms(total)}`);
}

// ── dev server ────────────────────────────────────────────────────────────

async function runDev(): Promise<void> {
  console.log("[dev] starting dev server…");

  // Dev serves the assets unhashed: esbuild's watch/serve writes a fixed
  // main.js, and re-hashing on every keystroke would churn filenames for no
  // benefit — caching only matters for the deployed site.
  setGlobalSlots({ css_href: "/main.css", js_href: "/main.js" });

  // Initial build (no clean — faster restarts)
  await mkdir(DIST_DIR, { recursive: true });
  await Promise.all([
    generateMissingScientistsPages(),
    stepCss(),
    stepAssets(),
  ]);

  // esbuild context for JS watch + serve
  const ctx = await esbuild.context({
    entryPoints: [join(SRC_DIR, "ts/main.ts")],
    bundle: true,
    format: "esm",
    target: "es2022",
    outfile: join(DIST_DIR, "main.js"),
    minify: false,
    sourcemap: true,
    logLevel: "info",
  });

  await ctx.watch();

  const serveResult = await ctx.serve({
    servedir: DIST_DIR,
    host: "localhost",
    port: 3001,
  });

  const host = serveResult.hosts[0] ?? "localhost";
  console.log(`[dev] serving on http://${host}:${serveResult.port}`);
  console.log("[dev] watching src/ for changes…");

  // Watch non-TS files with Node's fs.watch
  const { watch } = await import("node:fs");
  const WATCHED_EXTS = new Set([".css", ".html", ".md"]);

  watch(SRC_DIR, { recursive: true }, (_, filename) => {
    if (filename === null) return;
    const ext = filename.slice(filename.lastIndexOf("."));
    if (!WATCHED_EXTS.has(ext)) return;

    const t = now();

    if (ext === ".css") {
      concatCss()
        .then(() => console.log(`[dev] CSS rebuilt: ${ms(t)}`))
        .catch((err: unknown) => console.error("[dev] CSS error:", err));
    } else {
      // .md or .html — regenerate the dossier pages (clear template cache so
      // template edits are picked up between rebuilds)
      clearTemplateCache();
      generateMissingScientistsPages()
        .then(() => console.log(`[dev] pages rebuilt: ${ms(t)}`))
        .catch((err: unknown) => console.error("[dev] pages error:", err));
    }
  });

  // Keep the process alive
  process.on("SIGINT", () => {
    console.log("\n[dev] stopping…");
    ctx.dispose().finally(() => process.exit(0));
  });
}

// ── entry point ───────────────────────────────────────────────────────────

(isDev ? runDev() : runBuild()).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[build] fatal: ${message}`);
  process.exit(1);
});
