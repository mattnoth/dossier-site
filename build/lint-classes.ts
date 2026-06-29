import { readdir, readFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SRC_DIR = join(__dirname, "../src");
const CONTENT_DIR = join(SRC_DIR, "content");

// Allowlist: classes the lint must not flag as drift.
//
// Two narrow categories only. Do NOT add entries here to "unblock the build" —
// if a class is in this list it's because it has a documented, intentional
// reason to live without a direct match in the other side of the contract.
// Anything else is real drift and must be fixed at the source.
const JS_APPLIED: ReadonlySet<string> = new Set([
  // ── Category 1: state classes toggled at runtime by TS modules ───────
  // These appear in CSS rules but never in HTML source — they're added/removed
  // by classList calls in src/ts/. Verified by grepping `classList` in src/ts/.
  "nav--hidden",    // nav.ts — toggled on scroll direction
  "revealed",       // scroll-reveal.ts — added when element enters viewport
  "reveal-pending", // scroll-reveal.ts — initial pre-reveal state

  // ── Category 2: dormant component infrastructure ─────────────────────
  // These classes are CSS rules + JS module code waiting for a template
  // author to write the consuming HTML. carousel.ts queries .carousel-track
  // and .carousel-slide via qs/qsa, and dynamically creates .carousel-prev,
  // .carousel-next, .carousel-dots, .carousel-dot child elements. No current
  // template uses [data-module="carousel"], so the lint sees them as orphaned.
  // They're not dead — they're a complete component awaiting first use.
  "carousel-wrapper",
  "carousel-track",
  "carousel-slide",
  "carousel-prev",
  "carousel-next",
  "carousel-dots",
  "carousel-dot",

  // .stagger-1..4 are CSS animation-delay utilities (animations.css). They're
  // primitives available to any template author for staggered entrance
  // animations. No current template uses them.
  "stagger-1",
  "stagger-2",
  "stagger-3",
  "stagger-4",

  // .no-transition is a CSS rule in animations.css meant to be toggled by
  // theme-toggle.ts during theme switches. The current implementation uses
  // an inline style instead of classList — see the followup note in
  // docs/decisions.md (Phase 4 ADR-lite). When theme-toggle.ts is updated
  // to use classList for consistency, this entry can be removed.
  "no-transition",

  // ── Category 3: build-time transform classes ────────────────────────
  // transformRedacted() in markdown.ts converts [REDACTED] markers in
  // markdown content to <span class="redacted"> during HTML generation.
  // The lint scans source files, not built output, so it can't see these.
  "redacted",
  "redacted--peeking", // main.ts — toggled on click for peek animation
]);

// Collects all CSS files under a directory (non-recursive, flat — src/styles/ is flat).
async function listCssFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(dir, f));
}

// Collects all HTML files under a directory tree (recursive).
async function listHtmlFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  let entries: Dirent<string>[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await listHtmlFiles(full));
    } else if (entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

// Collects all markdown files under a directory tree (recursive).
async function listContentFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  let entries: Dirent<string>[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await listContentFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

// Strips fenced code blocks from markdown source before class scanning.
// Prevents false positives when articles illustrate HTML with class attributes
// in code examples. Known limitation: indented code blocks are not stripped,
// but those are uncommon in practice and won't typically contain class="...".
function stripFencedCodeBlocks(source: string): string {
  // Matches ``` or ~~~ fences with optional language tag, non-greedy content
  return source.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, "");
}

// Extracts class tokens from a string of HTML/template content.
// Handles both double-quoted and single-quoted class="..." attributes.
// Skips tokens that contain '{' or '$' (interpolation fragments).
function extractHtmlClasses(source: string): Set<string> {
  const classes = new Set<string>();
  const attrRe = /class\s*=\s*(?:"([^"]*?)"|'([^']*?)')/g;
  for (const match of source.matchAll(attrRe)) {
    const value = match[1] ?? match[2] ?? "";
    for (const token of value.split(/\s+/)) {
      if (token.length === 0) continue;
      if (token.includes("{") || token.includes("$")) continue;
      classes.add(token);
    }
  }
  return classes;
}

// Extracts class tokens from build/pages.ts, which uses template literals.
// We scan for class=" patterns regardless of quote style or escaping.
function extractPagesClasses(source: string): Set<string> {
  const classes = new Set<string>();
  // Match class="..." inside template literals (backtick strings embed regular quotes).
  // Also handles class=\\"...\\" for doubly-escaped variants in nested templates.
  const attrRe = /class\s*=\s*(?:\\?"([^"\\]*(?:\\.[^"\\]*)*)\\?"|'([^']*?)')/g;
  for (const match of source.matchAll(attrRe)) {
    const value = match[1] ?? match[2] ?? "";
    for (const token of value.split(/\s+/)) {
      if (token.length === 0) continue;
      if (token.includes("{") || token.includes("$")) continue;
      classes.add(token);
    }
  }
  return classes;
}

// Extracts CSS-defined class selectors from a CSS source string.
// Strips comments and string literals (url(), format(), quoted values) first,
// then matches .classname patterns.
// Requires the first char after '.' to be a letter or underscore (filters decimals).
function extractCssClasses(source: string): Set<string> {
  const classes = new Set<string>();
  // 1. Strip /* ... */ block comments (multi-line safe)
  let stripped = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // 2. Strip url(...) values — prevents false matches on domain names in @font-face src
  stripped = stripped.replace(/url\([^)]*\)/g, "url()");
  // 3. Strip format(...) values — prevents .woff2 etc. from matching
  stripped = stripped.replace(/format\([^)]*\)/g, "format()");
  // 4. Strip remaining quoted strings (single or double)
  stripped = stripped.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");

  const selectorRe = /\.([a-zA-Z_][\w-]*)/g;
  for (const match of stripped.matchAll(selectorRe)) {
    classes.add(match[1]!);
  }
  return classes;
}

function union<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
  const result = new Set(a);
  for (const item of b) result.add(item);
  return result;
}

function difference<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
  const result = new Set<T>();
  for (const item of a) {
    if (!b.has(item)) result.add(item);
  }
  return result;
}

export async function lintClasses(): Promise<void> {
  const stylesDir = join(SRC_DIR, "styles");
  const templatesDir = join(SRC_DIR, "templates");
  // Build scripts that emit HTML with class attributes (page generators)
  const pageGenerators = [
    join(__dirname, "missing-scientists.ts"),
  ];

  // Collect files in parallel
  const [cssFiles, htmlFiles, contentFiles] = await Promise.all([
    listCssFiles(stylesDir),
    listHtmlFiles(templatesDir),
    listContentFiles(CONTENT_DIR),
  ]);

  // Read all files in parallel
  const [cssContents, htmlContents, generatorSources, contentSources] = await Promise.all([
    Promise.all(cssFiles.map((f) => readFile(f, "utf-8"))),
    Promise.all(htmlFiles.map((f) => readFile(f, "utf-8"))),
    Promise.all(pageGenerators.map((f) => readFile(f, "utf-8").catch(() => ""))),
    Promise.all(contentFiles.map((f) => readFile(f, "utf-8"))),
  ]);

  // Build CSS class set
  let cssClasses = new Set<string>();
  for (const src of cssContents) {
    cssClasses = union(cssClasses, extractCssClasses(src));
  }

  // Build HTML-emitted class set from templates + page generators
  let htmlClasses = new Set<string>();
  for (const src of htmlContents) {
    htmlClasses = union(htmlClasses, extractHtmlClasses(src));
  }
  for (const src of generatorSources) {
    htmlClasses = union(htmlClasses, extractPagesClasses(src));
  }
  for (const src of contentSources) {
    htmlClasses = union(htmlClasses, extractHtmlClasses(stripFencedCodeBlocks(src)));
  }

  // Compute gaps, excluding JS-applied / allowlisted classes from both sides
  const effectiveCss = difference(cssClasses, JS_APPLIED);
  const effectiveHtml = difference(htmlClasses, JS_APPLIED);

  const missingInCss = difference(effectiveHtml, effectiveCss);
  const unusedInCss = difference(effectiveCss, effectiveHtml);

  const htmlCount = htmlClasses.size;
  const cssCount = cssClasses.size;

  if (missingInCss.size === 0 && unusedInCss.size === 0) {
    console.log(
      `[lint-classes] ok: ${htmlCount} HTML classes / ${cssCount} CSS classes in sync`,
    );
    return;
  }

  // missingInCss is fatal: a class used in HTML with no CSS rule is real drift.
  if (missingInCss.size > 0) {
    console.error(
      `[lint-classes] FAIL: ${missingInCss.size} classes emitted by HTML but undefined in CSS:`,
    );
    for (const cls of [...missingInCss].sort()) {
      console.error(`  - .${cls}`);
    }
  }

  // unusedInCss is non-fatal here. This site forked the personal-site engine and
  // inherits its full CSS intact (by design — the styling is shared, not
  // re-architected), but only renders the dossier templates. So a large set of
  // personal-site component classes have no HTML producer in this repo. That's
  // expected dead-but-inherited CSS, not drift — warn, don't fail.
  if (unusedInCss.size > 0) {
    console.warn(
      `[lint-classes] note: ${unusedInCss.size} CSS classes are defined but unused by any dossier HTML producer (inherited from the upstream engine — not fatal).`,
    );
  }

  if (missingInCss.size > 0) {
    throw new Error(`lint-classes: ${missingInCss.size} missing in CSS`);
  }
}
