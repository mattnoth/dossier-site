// build/missing-scientists.ts
// Generates the multi-dossier publication from research artifacts.
//
// The site has two tiers of chrome:
//   • Tier 1 (umbrella) — brand bar + shared pages (the dossier directory at
//     "/", Methodology, About/Transparency). Generated once, served at root.
//   • Tier 2 (per-dossier) — each dossier in the registry (site.config.ts) is
//     generated into its own namespaced subtree (`dossier.base`) with its own
//     section bar. `generateDossier()` is the generic per-dossier generator;
//     the entry point loops the registry.
//
// NOTE ON CONTENT SHAPE: the per-dossier generator currently assumes the
// Missing Scientists content shape (cases/, analysis/, sources appendices,
// glossary, tier badges). Routing, identity, and the section bar are fully
// driven by the registry, but a dossier with a *different* content structure
// would need this generator extended. With one dossier today that's fine.

import { readFile, readdir, mkdir, copyFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked, type Tokens } from "marked";

marked.use({
  renderer: {
    table(token: Tokens.Table): string {
      const inner = marked.Renderer.prototype.table.call(this, token);
      return `<div class="ms-table-wrap">${inner}</div>`;
    },
  },
});

import { renderPage } from "./templates.ts";
import {
  SITE_ORIGIN,
  brandName,
  brandTagline,
  dossiers,
  primaryDossier,
  type Dossier,
  social,
  footerNote,
  OG_IMAGE_PATH,
  ROBOTS,
} from "./site.config.ts";
import { transformRedacted } from "./markdown.ts";

const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}${OG_IMAGE_PATH}`;

function jsonLd(data: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

/** Shared SEO slots for all pages. */
function seoSlots(opts: {
  ogType?: string;
  jsonLdData?: Record<string, unknown>;
}): Record<string, string> {
  return {
    robots: ROBOTS,
    og_image: DEFAULT_OG_IMAGE,
    og_type: opts.ogType ?? "website",
    json_ld: opts.jsonLdData ? jsonLd(opts.jsonLdData) : "",
  };
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST_DIR = join(__dirname, "../dist");

/** Resolve a dossier's research source dir (env override wins). */
function resolveResearchDir(d: Dossier): string {
  const envVal = d.researchDirEnv ? process.env[d.researchDirEnv] : undefined;
  return envVal ?? join(__dirname, d.researchPath);
}

/** Output-path prefix under dist/ for a given base. "" → site root. */
function outPrefix(base: string): string {
  return base ? `${base.replace(/^\//, "")}/` : "";
}

const SOCIAL_LINKS_HTML = social
  .map(
    ({ label, href }) =>
      `<li><a href="${href}" rel="noopener noreferrer" target="_blank">${label}</a></li>`,
  )
  .join("\n            ");

// ── Case metadata (Missing Scientists content shape) ──────────────────

const CASE_ORDER = [
  "eskridge", "hicks", "maiwald", "chavez", "casias",
  "reza", "garcia", "thomas", "loureiro", "mccasland", "grillmair",
] as const;

const CASE_NAMES: Readonly<Record<string, string>> = {
  eskridge: "Amy Eskridge",
  hicks: "Michael David Hicks",
  maiwald: "Frank Maiwald",
  chavez: "Anthony Chavez",
  casias: "Melissa Casias",
  reza: "Monica Jacinto Reza",
  garcia: "Steven Garcia",
  thomas: "Jason Thomas",
  loureiro: "Nuno Loureiro",
  mccasland: "William Neil McCasland",
  grillmair: "Carl Grillmair",
};

// ── Per-dossier generation context ────────────────────────────────────

interface Ctx {
  readonly d: Dossier;
  /** d.base — base for this dossier's internal links and template chrome. */
  readonly base: string;
  readonly researchDir: string;
  readonly glossary: GlossaryEntry[];
  /** Output-path prefix under dist/. */
  readonly prefix: string;
}

// ── Tier-2 dossier section navigation ─────────────────────────────────

/** Tier-2 context bar: dossier identity + its internal sections. Rendered into
 *  the sticky header (base.html {{dossier_nav}}) so it travels with the active
 *  dossier and highlights the current section. `currentPath` is absolute. */
function generateDossierBar(d: Dossier, currentPath: string): string {
  const items = d.sections.map(s => {
    const href = `${d.base}${s.path}`;
    const isCurrent = currentPath === href;
    return `<li><a href="${href}"${isCurrent ? ' aria-current="page"' : ''}>${s.label}</a></li>`;
  }).join("\n            ");

  return `<div class="dossier-bar">
    <div class="container">
      <a href="${d.base}/" class="dossier-bar__label">${d.label}</a>
      <nav class="ms-nav" aria-label="Dossier sections">
        <ul class="ms-nav__links">
            ${items}
        </ul>
      </nav>
    </div>
  </div>`;
}

function generateCaseList(base: string, currentSlug?: string): string {
  const items = CASE_ORDER.map(slug => {
    const name = CASE_NAMES[slug] ?? slug;
    const isCurrent = slug === currentSlug;
    return `<li><a href="${base}/cases/${slug}/"${isCurrent ? ' aria-current="page"' : ''}>${name}</a></li>`;
  }).join("\n            ");

  return `<nav class="ms-case-nav" aria-label="Case index">
      <h3>Cases</h3>
      <ul>
          ${items}
      </ul>
  </nav>`;
}

// ── Glossary ──────────────────────────────────────────────────────────

interface GlossaryEntry { abbr: string; full: string; url?: string }

const glossaryCache = new Map<string, GlossaryEntry[]>();

async function loadGlossary(researchDir: string): Promise<GlossaryEntry[]> {
  const cached = glossaryCache.get(researchDir);
  if (cached) return cached;
  let entries: GlossaryEntry[];
  try {
    const raw = await readFile(join(researchDir, "data/glossary.json"), "utf-8");
    const data = JSON.parse(raw) as { entries: GlossaryEntry[] };
    // Sort longest-first so longer acronyms match before shorter substrings
    entries = data.entries.sort((a, b) => b.abbr.length - a.abbr.length);
  } catch {
    entries = [];
  }
  glossaryCache.set(researchDir, entries);
  return entries;
}

function applyGlossary(html: string, entries: GlossaryEntry[]): string {
  for (const { abbr, full, url } of entries) {
    // Escape special regex characters in the abbreviation
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match the abbreviation as a whole word, but NOT inside HTML tags or
    // already-wrapped <abbr> elements. We use a negative lookbehind for
    // tag context and only match text nodes.
    const re = new RegExp(
      `(?<![\\w/\\.">])${escaped}(?![\\w<])`,
      "g",
    );
    // Build the <abbr> element, optionally wrapped in an outbound link
    const abbrTag = `<abbr data-tooltip="${full.replace(/"/g, "&quot;")}" aria-label="${full.replace(/"/g, "&quot;")}">${abbr}</abbr>`;
    const replacement = url
      ? `<a href="${url}" class="glossary-link" target="_blank" rel="noopener">${abbrTag}</a>`
      : abbrTag;
    // Replace only in text content (outside of HTML tags)
    html = replaceInTextNodes(html, re, replacement);
  }
  return html;
}

/** Replace regex matches only in text content, not inside HTML tags or attributes. */
function replaceInTextNodes(
  html: string,
  pattern: RegExp,
  replacement: string | ((...args: string[]) => string),
): string {
  // Split HTML into tag vs text segments
  const parts = html.split(/(<[^>]+>)/);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    // Skip HTML tags (odd-indexed parts from the split, plus anything starting with <)
    if (part.startsWith("<")) continue;
    parts[i] = part.replace(pattern, replacement as Parameters<typeof part.replace>[1]);
  }
  return parts.join("");
}

// ── Tier descriptions and source-section anchors ─────────────────────

const TIER_DESCRIPTIONS: Record<string, string> = {
  "1": "Primary sources — law-enforcement releases, court filings, official statements",
  "2": "Secondary reporting — mainstream news with named sources",
  "3": "Tertiary / aggregator — Wikipedia, roundups citing other outlets",
  "4": "Named expert commentary — on-the-record statements from identified experts",
  "5": "Secondary reporting relying on anonymous sources",
  "6": "Independent commentary — Substack, YouTube, podcasts, social media",
  "7": "Foreign state-affiliated press",
};

/** Map tier number to the heading anchor on the same page where sources are listed. */
const TIER_ANCHORS: Record<string, string> = {
  "1": "#primary-sources",
  "2": "#secondary-sources",
  "3": "#secondary-sources",
  "4": "#named-expert-commentary",
  "5": "#secondary-sources",
  "6": "#secondary-sources",
  "7": "#foreign-coverage",
};

// ── Markdown processing ───────────────────────────────────────────────

async function readMarkdown(
  researchDir: string,
  relativePath: string,
  contentBase: string,
  glossary: GlossaryEntry[],
): Promise<string> {
  const raw = await readFile(join(researchDir, relativePath), "utf-8");
  return postProcess(String(await marked(raw)), contentBase, glossary);
}

/** `contentBase` is the base of the dossier that *owns* this markdown — used to
 *  rewrite internal case/analysis links. Methodology + About are shared
 *  (Tier-1) pages that live at the site root, so links to them are always
 *  root-absolute regardless of contentBase. */
function postProcess(html: string, contentBase: string, glossary: GlossaryEntry[] = []): string {
  // Style tier + confidence annotations: [T1], [T1 (source), Confirmed], etc.
  // Tier badges link to the source section on the same page (e.g. #primary-sources).
  // Tooltip shows the tier description + specific source attribution.
  // When the source text contains HTML links (from markdown link processing),
  // the source is rendered visibly alongside the badge so users can click through.
  html = html.replace(
    /\[T([1-7])(?:\s*\(([^)]*)\))?(?:,?\s*(Confirmed|Reported|Alleged|Speculated))?\]/g,
    (_match, num: string, source: string | undefined, confidence: string | undefined) => {
      const desc = TIER_DESCRIPTIONS[num] ?? `Tier ${num}`;
      const hasLink = source?.includes("<a ");
      // Strip HTML for the tooltip text
      const cleanSource = source
        ? source.replace(/<[^>]+>/g, "").trim().replace(/"/g, "&quot;")
        : "";
      const title = `${desc}${cleanSource ? ` — ${cleanSource}` : ""}`;
      const anchor = TIER_ANCHORS[num] ?? "#primary-sources";

      let result = `<a href="${anchor}" class="ms-tier-link"><span class="ms-tier" data-tier="${num}" title="${title}">T${num}</span></a>`;

      // When source text contains clickable links, show it visibly
      if (hasLink && source) {
        result += ` <span class="ms-source-attr">(${source})</span>`;
      }

      if (confidence) {
        result += ` <span class="ms-confidence" data-level="${confidence.toLowerCase()}">${confidence}</span>`;
      }
      return result;
    },
  );

  // Style standalone (T1), (T2), etc. parenthetical tier references (common in tables).
  // Only replace in text nodes to avoid matching inside HTML attributes or URLs.
  html = replaceInTextNodes(html, /\(T([1-7])\)/g, (_match: string, num: string) => {
    const desc = TIER_DESCRIPTIONS[num] ?? `Tier ${num}`;
    const anchor = TIER_ANCHORS[num] ?? "#primary-sources";
    return `(<a href="${anchor}" class="ms-tier-link"><span class="ms-tier" data-tier="${num}" title="${desc}">T${num}</span></a>)`;
  });

  // Convert internal markdown file references to website URLs.
  // Case + analysis links are dossier-internal → contentBase.
  html = html.replace(/href="cases\/([^"]+)\.md"/g, `href="${contentBase}/cases/$1/"`);
  html = html.replace(/href="analysis\/connection-analysis\.md"/g, `href="${contentBase}/analysis/connections/"`);
  html = html.replace(/href="analysis\/hypotheses\.md"/g, `href="${contentBase}/analysis/hypotheses/"`);
  html = html.replace(/href="analysis\/foreign-intel-layer\.md"/g, `href="${contentBase}/analysis/foreign-intel/"`);
  // Methodology + Transparency are shared Tier-1 pages at the site root.
  html = html.replace(/href="README\.md"/g, `href="/methodology/"`);
  html = html.replace(/href="logs\/[^"]*\.md"/g, `href="/transparency/"`);

  // Replace raw filename link text with display names
  for (const [slug, name] of Object.entries(CASE_NAMES)) {
    html = html.replace(
      new RegExp(`>cases/${slug}\\.md<`, "g"),
      `>${name}<`,
    );
  }
  html = html.replace(/>analysis\/connection-analysis\.md</g, ">Connection Analysis<");
  html = html.replace(/>analysis\/hypotheses\.md</g, ">Hypothesis Evaluation<");
  html = html.replace(/>analysis\/foreign-intel-layer\.md</g, ">Foreign Intelligence<");

  // Replace inline prose .md references (inside <code> tags or plain text)
  const proseReplacements: [RegExp, string][] = [
    [/<code>(?:analysis\/)?hypotheses\.md<\/code>/g, "the Hypothesis Evaluation"],
    [/<code>(?:analysis\/)?connection-analysis\.md<\/code>/g, "the Connection Analysis"],
    [/<code>(?:analysis\/)?foreign-intel-layer\.md<\/code>/g, "the Foreign Intelligence Assessment"],
    [/<code>(?:logs\/)?research-log\.md<\/code>/g, "the Research Log"],
    [/<code>(?:logs\/)?contradictions\.md<\/code>/g, "the Contradictions tracker"],
    [/<code>(?:logs\/)?known-unknowns\.md<\/code>/g, "the Known Unknowns register"],
    [/<code>README\.md<\/code>/g, "the Methodology"],
    [/<code>dossier\.md<\/code>/g, "the Dossier"],
  ];
  for (const [slug, name] of Object.entries(CASE_NAMES)) {
    proseReplacements.push([
      new RegExp(`<code>(?:cases/)?${slug}\\.md</code>`, "g"),
      name,
    ]);
  }
  for (const [pattern, replacement] of proseReplacements) {
    html = html.replace(pattern, replacement);
  }

  // Apply glossary tooltips to acronyms
  if (glossary.length > 0) {
    html = applyGlossary(html, glossary);
  }

  return transformRedacted(html);
}

// ── Heading level adjustment ─────────────────────────────────────────

/** Shift all heading levels down by `shift` (e.g. h1→h3, h2→h4 when shift=2).
 *  Also adds an id to the former-h1 for deep-linking. */
function downgradeHeadings(html: string, shift: number): string {
  return html.replace(
    /<(\/?)h([1-6])((?:\s[^>]*)?)>/g,
    (_match, slash: string, levelStr: string, attrs: string) => {
      const oldLevel = Number(levelStr);
      const newLevel = Math.min(oldLevel + shift, 6);
      // For the top-level heading (h1), add an id if not already present
      if (oldLevel === 1 && !slash && !attrs.includes("id=")) {
        // Extract text content to generate an id
        const afterTag = html.slice(html.indexOf(_match) + _match.length);
        const closingIdx = afterTag.indexOf(`</h${oldLevel}>`);
        if (closingIdx >= 0) {
          const inner = afterTag.slice(0, closingIdx);
          const text = inner.replace(/<[^>]+>/g, "").trim();
          const id = text.toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/^-+|-+$/g, "") || "section";
          return `<h${newLevel} id="${id}"${attrs}>`;
        }
      }
      return `<${slash}h${newLevel}${attrs}>`;
    },
  );
}

// ── Heading IDs and table of contents ─────────────────────────────────

function addHeadingIds(html: string): { toc: string; html: string } {
  const headings: { level: number; id: string; text: string }[] = [];
  const usedIds = new Set<string>();

  const processed = html.replace(
    /<h([2-4])(?:\s+id="([^"]*)")?((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/g,
    (_match, levelStr: string, existingId: string | undefined, otherAttrs: string, inner: string) => {
      const level = Number(levelStr);
      const text = inner.replace(/<[^>]+>/g, "").trim();
      let id = existingId ?? text.toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!id) id = "section";
      // Deduplicate IDs
      const baseId = id;
      let counter = 2;
      while (usedIds.has(id)) {
        id = `${baseId}-${counter}`;
        counter++;
      }
      usedIds.add(id);
      headings.push({ level, id, text });
      return `<h${level} id="${id}"${otherAttrs}>${inner}</h${level}>`;
    },
  );

  if (headings.length === 0) return { toc: "", html };

  const tocItems = headings
    .filter(h => h.level <= 3)
    .map(h => `<li class="ms-toc__item" data-level="${h.level}"><a href="#${h.id}">${h.text}</a></li>`)
    .join("\n        ");

  const toc = `<nav class="ms-toc" aria-label="Table of contents">
    <details open>
      <summary>Contents</summary>
      <ol>
        ${tocItems}
      </ol>
    </details>
    <script>
      (function(){
        var nav = document.currentScript.closest('.ms-toc');
        var det = nav.querySelector('details');
        // Close on click outside
        document.addEventListener('click', function(e){
          if (det.open && !nav.contains(e.target)) det.open = false;
        });
        // Close on TOC link click (mobile navigation)
        nav.addEventListener('click', function(e){
          if (e.target.closest('.ms-toc__item a')) det.open = false;
        });
        // Start closed on mobile
        if (window.innerWidth < 1024) det.open = false;
      })();
    </script>
  </nav>`;

  return { toc, html: processed };
}

function extractTitle(html: string): { title: string; html: string } {
  const match = html.match(/<h1>([\s\S]*?)<\/h1>/);
  if (!match) return { title: "", html };
  const title = (match[1] ?? "").replace(/<[^>]+>/g, "").trim();
  const cleaned = html.replace(/<h1>[\s\S]*?<\/h1>\s*/, "");
  return { title, html: cleaned };
}

// ── Page writer ───────────────────────────────────────────────────────

async function writePage(relPath: string, htmlContent: string): Promise<void> {
  const fullPath = join(DIST_DIR, relPath);
  const dir = fullPath.replace(/\/[^/]+$/, "");
  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, htmlContent, "utf-8");
  console.log(`[ms] wrote ${relPath}`);
}

async function generatePage(
  templateName: string,
  slots: Record<string, string>,
  outputPath: string,
): Promise<void> {
  const html = await renderPage(templateName, {
    social_links: SOCIAL_LINKS_HTML,
    brand_name: brandName,
    site_name: brandName,
    footer_note: footerNote,
    dossier_nav: "",
    base: "",
    ...slots,
  });
  if (html === null) {
    console.warn(`[ms] template ${templateName} not found`);
    return;
  }
  await writePage(outputPath, html);
}

// ── Version info ──────────────────────────────────────────────────────

async function getVersion(researchDir: string): Promise<{ version: string; lastUpdated: string }> {
  try {
    const changelog = await readFile(join(researchDir, "CHANGELOG.md"), "utf-8");
    const m = changelog.match(/## (v[\d.]+)\s*—\s*(\d{4}-\d{2}-\d{2})/);
    if (m) return { version: m[1]!, lastUpdated: m[2]! };
  } catch { /* use defaults */ }
  return { version: "0.1", lastUpdated: new Date().toISOString().slice(0, 10) };
}

// ── Per-dossier page generators ───────────────────────────────────────

async function generateOverview(ctx: Ctx, version: string, lastUpdated: string): Promise<void> {
  const { d, base, researchDir, glossary } = ctx;
  const rawHtml = await readMarkdown(researchDir, "dossier.md", base, glossary);
  const { title, html: bodyHtml } = extractTitle(rawHtml);
  const { toc, html: contentHtml } = addHeadingIds(bodyHtml);

  const pageTitle = title || "Deaths and Disappearances of U.S. Defense Scientists";

  const landingUrl = `${SITE_ORIGIN}${base}/`;
  await generatePage("ms-page.html", {
    base,
    site_name: d.name,
    title: `${pageTitle} — ${d.name}`,
    description: d.tagline,
    page_url: landingUrl,
    ...seoSlots({
      jsonLdData: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: pageTitle,
        url: landingUrl,
        description: d.tagline,
        author: { "@type": "Person", name: d.author, url: SITE_ORIGIN },
      },
    }),
    page_title: pageTitle,
    dossier_nav: generateDossierBar(d, `${base}/`),
    breadcrumb: "",
    meta: "",
    analysis_nav: "",
    toc,
    content: contentHtml,
    prev_next: "",
    case_list: generateCaseList(base),
    version_info: `<p class="ms-version">Research ${version} &middot; Updated ${lastUpdated}</p>`,
  }, `${ctx.prefix}index.html`);
}

async function generateCasePages(ctx: Ctx): Promise<void> {
  const { d, base, researchDir, glossary } = ctx;
  for (let i = 0; i < CASE_ORDER.length; i++) {
    const slug = CASE_ORDER[i]!;
    const name = CASE_NAMES[slug] ?? slug;
    const rawHtml = await readMarkdown(researchDir, `cases/${slug}.md`, base, glossary);
    const { title, html: bodyHtml } = extractTitle(rawHtml);
    const { toc, html: contentHtml } = addHeadingIds(bodyHtml);

    const prevSlug = i > 0 ? CASE_ORDER[i - 1] : undefined;
    const nextSlug = i < CASE_ORDER.length - 1 ? CASE_ORDER[i + 1] : undefined;

    let prevNext = "";
    if (prevSlug || nextSlug) {
      const prev = prevSlug
        ? `<a href="${base}/cases/${prevSlug}/" class="ms-prev-next__link ms-prev-next__link--prev">&larr; ${CASE_NAMES[prevSlug] ?? prevSlug}</a>`
        : "<span></span>";
      const next = nextSlug
        ? `<a href="${base}/cases/${nextSlug}/" class="ms-prev-next__link ms-prev-next__link--next">${CASE_NAMES[nextSlug] ?? nextSlug} &rarr;</a>`
        : "<span></span>";
      prevNext = `<nav class="ms-prev-next" aria-label="Case navigation">${prev}${next}</nav>`;
    }

    const caseUrl = `${SITE_ORIGIN}${base}/cases/${slug}/`;
    const caseDesc = `Case file: ${name}. Part of ${d.name}.`;
    await generatePage("ms-page.html", {
      base,
      site_name: d.name,
      title: `${title || name} — Research — ${d.name}`,
      description: caseDesc,
      page_url: caseUrl,
      ...seoSlots({
        ogType: "article",
        jsonLdData: {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title || name,
          description: caseDesc,
          url: caseUrl,
          author: { "@type": "Person", name: d.author, url: SITE_ORIGIN },
          publisher: { "@type": "Person", name: d.author, url: SITE_ORIGIN },
        },
      }),
      page_title: title || name,
      dossier_nav: generateDossierBar(d, `${base}/cases/${slug}/`),
      breadcrumb: `<nav class="ms-breadcrumb" aria-label="Breadcrumb"><a href="${base}/">Overview</a> &rsaquo; <span aria-current="page">${name}</span></nav>`,
      meta: "",
      analysis_nav: "",
      toc,
      content: contentHtml,
      prev_next: prevNext,
      case_list: generateCaseList(base, slug),
      version_info: "",
    }, `${ctx.prefix}cases/${slug}/index.html`);
  }
}

async function generateAnalysisPages(ctx: Ctx): Promise<void> {
  const { d, base, researchDir, glossary } = ctx;
  const pages = [
    { file: "connection-analysis.md", slug: "connections", label: "Connection Analysis" },
    { file: "hypotheses.md", slug: "hypotheses", label: "Hypothesis Evaluation" },
    { file: "foreign-intel-layer.md", slug: "foreign-intel", label: "Foreign Intelligence Assessment" },
  ];

  for (const { file, slug, label } of pages) {
    const rawHtml = await readMarkdown(researchDir, `analysis/${file}`, base, glossary);
    const { title, html: bodyHtml } = extractTitle(rawHtml);
    const { toc, html: contentHtml } = addHeadingIds(bodyHtml);

    const navHtml = `<nav class="ms-analysis-nav" aria-label="Analysis sections"><ul>${
      pages.map(p =>
        `<li><a href="${base}/analysis/${p.slug}/"${p.slug === slug ? ' aria-current="page"' : ''}>${p.label}</a></li>`,
      ).join("")
    }</ul></nav>`;

    const analysisUrl = `${SITE_ORIGIN}${base}/analysis/${slug}/`;
    const analysisDesc = `${label}. Part of ${d.name}.`;
    await generatePage("ms-page.html", {
      base,
      site_name: d.name,
      title: `${title || label} — Research — ${d.name}`,
      description: analysisDesc,
      page_url: analysisUrl,
      ...seoSlots({
        ogType: "article",
        jsonLdData: {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title || label,
          description: analysisDesc,
          url: analysisUrl,
          author: { "@type": "Person", name: d.author, url: SITE_ORIGIN },
          publisher: { "@type": "Person", name: d.author, url: SITE_ORIGIN },
        },
      }),
      page_title: title || label,
      dossier_nav: generateDossierBar(d, `${base}/analysis/${slug}/`),
      breadcrumb: `<nav class="ms-breadcrumb" aria-label="Breadcrumb"><a href="${base}/">Overview</a> &rsaquo; <span aria-current="page">Analysis</span></nav>`,
      meta: "",
      analysis_nav: navHtml,
      toc,
      content: contentHtml,
      prev_next: "",
      case_list: "",
      version_info: "",
    }, `${ctx.prefix}analysis/${slug}/index.html`);
  }
}

async function generateDiagramPage(ctx: Ctx): Promise<void> {
  const { d, base } = ctx;
  const diagramUrl = `${SITE_ORIGIN}${base}/diagram/`;
  await generatePage("ms-diagram.html", {
    base,
    site_name: d.name,
    title: `Connection Diagram — Research — ${d.name}`,
    description: "Interactive connection diagram showing relationships between cases, institutions, and programs.",
    page_url: diagramUrl,
    ...seoSlots({}),
    page_title: "Connection Diagram",
    dossier_nav: generateDossierBar(d, `${base}/diagram/`),
  }, `${ctx.prefix}diagram/index.html`);
}

async function generateTimelinePage(ctx: Ctx): Promise<void> {
  const { d, base } = ctx;
  const timelineUrl = `${SITE_ORIGIN}${base}/timeline/`;
  await generatePage("ms-timeline.html", {
    base,
    site_name: d.name,
    title: `Event Timeline — Research — ${d.name}`,
    description: "Interactive chronological timeline of all documented events.",
    page_url: timelineUrl,
    ...seoSlots({}),
    page_title: "Event Timeline",
    dossier_nav: generateDossierBar(d, `${base}/timeline/`),
  }, `${ctx.prefix}timeline/index.html`);
}

async function generateSourcesPage(ctx: Ctx): Promise<void> {
  const { d, base, researchDir, glossary } = ctx;
  let content = "";

  // Expert commentary
  try {
    const dir = join(researchDir, "appendices/named-expert-commentary");
    const files = (await readdir(dir)).filter(f => f.endsWith(".md")).sort();
    if (files.length > 0) {
      content += "<h2>Named Expert Commentary</h2>\n";
      for (const file of files) {
        const raw = await readFile(join(dir, file), "utf-8");
        let sectionHtml = postProcess(String(await marked(raw)), base, glossary);
        // Downgrade heading levels so they nest under the h2
        sectionHtml = downgradeHeadings(sectionHtml, 2);
        content += `<section class="ms-source-section">${sectionHtml}</section>\n`;
      }
    }
  } catch { /* directory may not exist */ }

  // Foreign coverage
  try {
    const dir = join(researchDir, "appendices/foreign-coverage");
    const files = (await readdir(dir)).filter(f => f.endsWith(".md")).sort();
    if (files.length > 0) {
      content += "<h2>Foreign Coverage</h2>\n";
      for (const file of files) {
        const raw = await readFile(join(dir, file), "utf-8");
        let sectionHtml = postProcess(String(await marked(raw)), base, glossary);
        sectionHtml = downgradeHeadings(sectionHtml, 2);
        content += `<section class="ms-source-section">${sectionHtml}</section>\n`;
      }
    }
  } catch { /* directory may not exist */ }

  const { toc, html: contentHtml } = addHeadingIds(content);

  const sourcesUrl = `${SITE_ORIGIN}${base}/sources/`;
  await generatePage("ms-page.html", {
    base,
    site_name: d.name,
    title: `Sources & Commentary — Research — ${d.name}`,
    description: "Consolidated expert commentary and foreign coverage.",
    page_url: sourcesUrl,
    ...seoSlots({}),
    page_title: "Sources & Commentary",
    dossier_nav: generateDossierBar(d, `${base}/sources/`),
    breadcrumb: `<nav class="ms-breadcrumb" aria-label="Breadcrumb"><a href="${base}/">Overview</a> &rsaquo; <span aria-current="page">Sources</span></nav>`,
    meta: "",
    analysis_nav: "",
    toc,
    content: contentHtml,
    prev_next: "",
    case_list: "",
    version_info: "",
  }, `${ctx.prefix}sources/index.html`);
}

async function copyDataFiles(ctx: Ctx): Promise<void> {
  const dataDir = join(DIST_DIR, `${ctx.prefix}data`);
  await mkdir(dataDir, { recursive: true });
  await Promise.all([
    copyFile(join(ctx.researchDir, "data/diagram-data.json"), join(dataDir, "diagram-data.json")),
    copyFile(join(ctx.researchDir, "data/timeline-data.json"), join(dataDir, "timeline-data.json")),
  ]);
  console.log(`[ms] copied data files → ${ctx.prefix}data/`);
}

/** Generic per-dossier generator. Produces the dossier's namespaced subtree. */
async function generateDossier(d: Dossier): Promise<void> {
  const researchDir = resolveResearchDir(d);

  // Skip gracefully when the research repo isn't available (e.g. Netlify CI)
  try {
    await access(join(researchDir, "dossier.md"));
  } catch {
    console.log("[ms] research repo for '%s' not found at %s — skipping", d.id, researchDir);
    return;
  }

  console.log(`[ms] generating dossier '${d.id}' at ${d.base || "/"}…`);
  const glossary = await loadGlossary(researchDir);
  const ctx: Ctx = { d, base: d.base, researchDir, glossary, prefix: outPrefix(d.base) };
  const { version, lastUpdated } = await getVersion(researchDir);

  await Promise.all([
    generateOverview(ctx, version, lastUpdated),
    generateCasePages(ctx),
    generateAnalysisPages(ctx),
    generateDiagramPage(ctx),
    generateTimelinePage(ctx),
    generateSourcesPage(ctx),
    copyDataFiles(ctx),
  ]);
}

// ── Umbrella (Tier-1) page generators ─────────────────────────────────

/** The dossier directory served at "/". Lists every registered dossier. */
async function generateUmbrellaLanding(): Promise<void> {
  // Only surface dossiers whose research repo is actually present.
  const available = (await Promise.all(
    dossiers.map(async d => {
      try {
        await access(join(resolveResearchDir(d), "dossier.md"));
        return d;
      } catch {
        return null;
      }
    }),
  )).filter((d): d is Dossier => d !== null);

  const cards = available.map(d => `<article class="card">
        <header>
          <h2><a href="${d.base}/">${d.label}</a></h2>
        </header>
        <p>${d.blurb}</p>
        <div class="tags"><span class="tag">${d.status}</span></div>
      </article>`).join("\n      ");

  const landingUrl = `${SITE_ORIGIN}/`;
  await generatePage("umbrella.html", {
    title: brandName,
    description: brandTagline,
    page_url: landingUrl,
    ...seoSlots({
      jsonLdData: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: brandName,
        url: landingUrl,
        description: brandTagline,
      },
    }),
    page_title: brandName,
    tagline: brandTagline,
    dossier_cards: cards,
  }, "index.html");
}

/** Shared Methodology page (Tier-1). Sourced from the primary dossier's repo. */
async function generateMethodologyPage(): Promise<void> {
  const researchDir = resolveResearchDir(primaryDossier);
  try {
    await access(join(researchDir, "README.md"));
  } catch {
    return;
  }
  const glossary = await loadGlossary(researchDir);
  const rawHtml = await readMarkdown(researchDir, "README.md", primaryDossier.base, glossary);
  const { title, html: bodyHtml } = extractTitle(rawHtml);
  const { toc, html: contentHtml } = addHeadingIds(bodyHtml);

  const methodologyUrl = `${SITE_ORIGIN}/methodology/`;
  await generatePage("ms-page.html", {
    base: "",
    title: `Methodology — ${brandName}`,
    description: "Research methodology, source tier taxonomy, and confidence rating system.",
    page_url: methodologyUrl,
    ...seoSlots({}),
    page_title: title || "Methodology",
    dossier_nav: "",
    breadcrumb: `<nav class="ms-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span aria-current="page">Methodology</span></nav>`,
    meta: "",
    analysis_nav: "",
    toc,
    content: contentHtml,
    prev_next: "",
    case_list: "",
    version_info: "",
  }, "methodology/index.html");
}

/** Shared About / Transparency page (Tier-1). Sourced from the primary dossier. */
async function generateTransparencyPage(): Promise<void> {
  const researchDir = resolveResearchDir(primaryDossier);
  try {
    await access(join(researchDir, "dossier.md"));
  } catch {
    return;
  }
  const glossary = await loadGlossary(researchDir);
  let content = "";

  // Project overview & disclosure — appears at the top of Transparency
  content += `<section class="ms-transparency-section">
<h2>About This Project</h2>
<p>This dossier tracks a cluster of U.S. defense and advanced-research scientists who died or disappeared between 2022 and 2026. It compiles publicly available information into a structured, evidence-based format with source tiering, confidence ratings, and cross-case analysis.</p>
<h3>AI-Assisted Research</h3>
<p>This project was built using AI-assisted research methods. <a href="https://claude.ai">Claude</a> (Anthropic) was used as a research partner under human direction — surfacing sources, structuring evidence, identifying connections, and drafting analysis. All editorial decisions, source evaluation, and publication choices were made by the human researcher.</p>
<p>The methodology, including the source-tier taxonomy and confidence rating system, is documented on the <a href="/methodology/">Methodology</a> page.</p>
<h3>Source Code</h3>
<p>The research repository, including raw data, analysis scripts, and the full research log, is available on GitHub: <a href="https://github.com/mattnoth/research-missing-scientists" rel="noopener noreferrer" target="_blank">mattnoth/research-missing-scientists</a>.</p>
</section>\n`;

  const sections = [
    { file: "logs/contradictions.md", label: "Contradictions" },
    { file: "logs/known-unknowns.md", label: "Known Unknowns" },
    { file: "logs/research-log.md", label: "Research Log" },
  ];

  for (const { file, label } of sections) {
    try {
      const rawHtml = await readMarkdown(researchDir, file, primaryDossier.base, glossary);
      const isLog = label === "Research Log";
      content += isLog
        ? `<section class="ms-transparency-section"><details><summary>${label} (click to expand)</summary>${rawHtml}</details></section>\n`
        : `<section class="ms-transparency-section">${rawHtml}</section>\n`;
    } catch { /* file may not exist */ }
  }

  const { toc, html: contentHtml } = addHeadingIds(content);

  const transparencyUrl = `${SITE_ORIGIN}/transparency/`;
  await generatePage("ms-page.html", {
    base: "",
    title: `Transparency — ${brandName}`,
    description: "Research log, contradictions, and known unknowns.",
    page_url: transparencyUrl,
    ...seoSlots({}),
    page_title: "Transparency",
    dossier_nav: "",
    breadcrumb: `<nav class="ms-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span aria-current="page">Transparency</span></nav>`,
    meta: "",
    analysis_nav: "",
    toc,
    content: contentHtml,
    prev_next: "",
    case_list: "",
    version_info: "",
  }, "transparency/index.html");
}

// ── Entry point ───────────────────────────────────────────────────────

export async function generateMissingScientistsPages(): Promise<void> {
  console.log("[ms] generating publication…");

  // Per-dossier subtrees (each skips itself if its research repo is absent).
  for (const d of dossiers) {
    await generateDossier(d);
  }

  // Tier-1 umbrella chrome.
  await Promise.all([
    generateUmbrellaLanding(),
    generateMethodologyPage(),
    generateTransparencyPage(),
  ]);

  console.log("[ms] done");
}
