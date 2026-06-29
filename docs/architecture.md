# mattnoth.dev — Architecture Reference

A portable reference for converting another site to this design pattern. Captures the *what* and the *why* at enough depth that a fresh Claude session (or another agent/engineer) can re-derive the structure without this repo open.

---

## 1. Philosophy

**Zero framework runtime, modern language features.**

The project bans React/Vue/Svelte, Sass/PostCSS, Tailwind, CSS-in-JS, `any`, enums, and namespaces. It does NOT ban modern TypeScript, modern DOM APIs, or modern CSS — those are zero-cost at runtime and the whole point of building this way. The rule of thumb:

- Prefer CSS over JS for visuals and state toggling.
- Prefer build-time work over runtime work.
- Prefer progressive enhancement (`@supports`, feature detection) over polyfills.
- Prefer the simpler solution; vanilla before library.

Output is static HTML/CSS/JS. Deploy target is any static host (this repo uses Netlify's free tier). No server runtime, no environment variables, no secrets.

---

## 2. Stack

| Layer          | Choice |
|----------------|--------|
| Language       | TypeScript 5.8+, target ES2024 |
| Styling        | Native CSS (no preprocessors) |
| Content        | Markdown + frontmatter via `gray-matter` + `marked` |
| Bundler        | `esbuild` (browser JS only) |
| Build scripts  | Custom TS files run through `tsx` |
| Type check     | `tsc --noEmit`, run separately from the bundler |
| Dev server     | `esbuild` `context.serve()` + `context.watch()` for JS; Node `fs.watch` for CSS/HTML/MD |
| Hosting        | Netlify free tier (any static host works) |
| Node           | 22+ (LTS); `"type": "module"` in package.json |

**Total runtime dependencies: 0.** All deps are devDependencies (esbuild, gray-matter, marked, tsx, typescript, @types/node).

---

## 3. Directory layout

```
repo-root/
├── build/                   # Node-target TS pipeline (run via tsx)
│   ├── build.ts             # Entry: runBuild() and runDev()
│   ├── markdown.ts          # Parse frontmatter + render body to HTML
│   ├── templates.ts         # {{slot}} replacement + base.html wrapping
│   ├── pages.ts             # Orchestrates template + slots → dist/*.html
│   ├── sitemap.ts           # dist/sitemap.xml from parsed content
│   ├── copy-assets.ts       # CSS concat + static file copy
│   └── lint-classes.ts      # HTML↔CSS class-drift lint (build gate)
├── src/
│   ├── ts/                  # Browser-side TS
│   │   ├── main.ts          # Entry; mounts modules via [data-module]
│   │   ├── modules/         # One file per interactive module
│   │   │   ├── nav.ts
│   │   │   ├── theme-toggle.ts
│   │   │   ├── scroll-reveal.ts
│   │   │   └── carousel.ts
│   │   └── utils/dom.ts     # Typed qs/qsa/on/create helpers
│   ├── styles/              # Native CSS, one file per @layer
│   │   ├── main.css         # @layer declaration order ONLY
│   │   ├── reset.css
│   │   ├── tokens.css       # Design tokens (oklch colors, spacing, type)
│   │   ├── typography.css
│   │   ├── layout.css
│   │   ├── nav.css
│   │   ├── components.css
│   │   └── animations.css
│   ├── templates/           # HTML with {{slot}} placeholders
│   │   ├── base.html        # <html> shell: head, header, main, footer
│   │   ├── home.html
│   │   ├── about.html
│   │   ├── article.html
│   │   ├── article-list.html
│   │   ├── project.html
│   │   └── project-list.html
│   ├── content/
│   │   ├── articles/*.md    # One article per file, YAML frontmatter + body
│   │   └── projects/*.md
│   ├── assets/              # Copied verbatim to dist/assets/
│   ├── favicon.svg
│   └── robots.txt
├── dist/                    # Build output; gitignored; deploy artifact
├── docs/                    # Phase prompts, progress, decisions, KB
├── netlify.toml             # Build command, cache + security headers
├── tsconfig.json            # Browser tsconfig (ES2024, moduleResolution=bundler)
├── tsconfig.build.json      # Build-script tsconfig (NodeNext)
├── package.json
└── README.md
```

### Ownership boundaries

Each directory has exactly one "owner" role. This matters for agent/subagent delegation but also for humans reasoning about cross-cutting concerns:

| Directory | Owner role | Touches |
|-----------|------------|---------|
| `build/` | build-specialist | Markdown parsing, templating, esbuild, dev server |
| `src/styles/` | css-specialist | All native CSS, @layer, tokens |
| `src/ts/` | ts-specialist | Browser TS modules |
| `src/templates/` | content-specialist | HTML templates |
| `src/content/` | content-specialist | Markdown articles/projects |
| Root config | build-specialist | package.json, tsconfig*.json, netlify.toml |

The boundary between `templates/` (semantic HTML, classes, `data-module` hooks) and `styles/` (the rules those classes point to) is enforced by `build/lint-classes.ts` — see §8.

---

## 4. TypeScript configuration

Two tsconfigs because browser code and build scripts target different runtimes. Both are typecheck-only — esbuild handles browser emit; `tsx` handles build-script execution.

**`tsconfig.json` (browser, under `src/`):**

```jsonc
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "strict": true,
    "verbatimModuleSyntax": true,   // forces import type / export type
    "erasableSyntaxOnly": true,     // bans enums, namespaces, parameter props
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**`tsconfig.build.json` (build scripts, under `build/`):**

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2024"],
    "types": ["node"],
    "noEmit": true,
    "allowImportingTsExtensions": true  // build/ imports `./markdown.ts`
  },
  "include": ["build/**/*"]
}
```

`npm run typecheck` runs both sequentially. `npm run build` does the typechecks, then runs the build.

---

## 5. Build pipeline

Single entry point: `build/build.ts`. Two modes: `--dev` (esbuild context + watch + serve) and production (one-shot).

### Production run order

```
1. clean dist/
2. parseContentDir(articles) + parseContentDir(projects)   (parallel)
3. generateAllPages(articles, projects)
4. lintClasses()            ← build gate; throws on HTML↔CSS drift
5. generateSitemap(articles, projects)
6. concatCss()
7. esbuild.build(src/ts/main.ts → dist/main.js)   (minified, sourcemap)
8. copyAssets()             ← src/assets/ → dist/assets/; root statics
```

### Dev mode

- Skips `clean` for faster restarts.
- Initial pass: parse content, generate pages, concat CSS, copy assets in parallel.
- `esbuild.context()` with `.watch()` + `.serve({ servedir: "dist", port: 3000 })` handles JS.
- `fs.watch(SRC_DIR, { recursive: true })` triggers rebuilds on `.css`, `.html`, `.md` changes.
- CSS changes rerun `concatCss()` only; HTML/MD changes re-parse content and regenerate pages.

### Why esbuild only for JS

CSS is concatenated manually (see §7) rather than processed by esbuild. Reasons: no preprocessing needed, CSS cascade order matters and must match the `@layer` declaration exactly, and skipping esbuild for CSS keeps CSS builds ~free.

---

## 6. Templating system

Handrolled `{{slot}}` substitution — no template engine dependency. The entire implementation is ~60 lines in `build/templates.ts`.

### Contract

- Templates live in `src/templates/*.html` and use `{{snake_case}}` placeholders.
- `base.html` is the outer shell; it has a `{{content}}` slot.
- Every other template renders into `{{content}}`. Shared slots (`{{title}}`, `{{description}}`, `{{page_url}}`, `{{social_links}}`) propagate to both levels.
- `renderPage(templateName, slots)` loads the inner template, renders it, then wraps the result in `base.html`.
- Stubs: a template whose trimmed body starts with `<!--` AND contains no `{{` is treated as non-existent. This lets you scaffold empty templates without the build failing.

### Example — `base.html` (abridged)

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{title}}</title>
    <meta name="description" content="{{description}}">
    <meta property="og:title" content="{{title}}">
    <meta property="og:url" content="{{page_url}}">
    <link rel="stylesheet" href="/main.css">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <script type="module" src="/main.js"></script>
  </head>
  <body>
    <a href="#content" id="skip-link">Skip to content</a>
    <header class="site-header nav" data-module="nav">…</header>
    <main id="content" data-module="scroll-reveal">
      {{content}}
    </main>
    <footer class="site-footer">…{{social_links}}…</footer>
  </body>
</html>
```

### `pages.ts` responsibilities

- Defines the site's `SITE_ORIGIN` (`https://mattnoth.dev`).
- Defines `SOCIAL_LINKS` (typed, with an `enabled` flag) and pre-renders the social link HTML once.
- Provides small template-literal helpers for card HTML (`articleCard`, `projectCard`) — HTML generated in TS still goes through the class-drift lint (§8).
- Iterates articles and projects, calling `generatePage(templateName, slots, outputPath, label)` for each.
- Routing is file-path-based: `dist/articles/<slug>/index.html`, `dist/projects/<slug>/index.html`, etc. This gives clean URLs without server rewrites (Netlify's `pretty_urls` handles trailing-slash behavior, but directory indexes work on any static host).

### Why no template engine

- The substitution logic fits in 30 lines.
- No escaping hazards — content is already trusted (we authored it) and `marked` handles markdown-to-HTML.
- Adding a template engine would introduce a syntax to learn, a dependency to update, and a chance that template errors become runtime errors rather than TS errors.

---

## 7. CSS architecture

Native modern CSS only. One `@layer` per concern.

### `main.css` declares layer order — nothing else

```css
@layer reset, tokens, typography, layout, components, animations, utilities;
```

Every other CSS file wraps all its rules in `@layer <name> { … }`. This eliminates specificity wars without `!important` — later layers always win, regardless of selector specificity.

### File → layer mapping

| File | Layer | Contains |
|------|-------|----------|
| `reset.css` | reset | Modern reset; `*, *::before, *::after { box-sizing: border-box }` etc. |
| `tokens.css` | tokens | `:root` design tokens; `[data-theme="dark"]` and `[data-theme="light"]` overrides |
| `typography.css` | typography | Body font-stack defaults, heading sizes, `.prose` for article bodies |
| `layout.css` | layout | `body` grid, `.container`, `.section`, `.hero`, `.grid-auto`, `.about`, `.site-header`, `.site-footer` |
| `nav.css` | components | (Kept as its own file for readability; still uses `@layer components`) |
| `components.css` | components | `.card`, `.btn`, `.tag`, `.tech`, tags, article chrome, carousel, etc. |
| `animations.css` | animations | `@keyframes` + `[data-reveal]` rules under `@supports (animation-timeline: view())` |

### CSS concat logic (`build/copy-assets.ts`)

- Reads the files in a fixed `CSS_LAYER_ORDER` array, starting with `main.css` (layer declaration).
- Skips files that are stubs (trimmed content starts with `/*` and is entirely comments) or missing.
- Joins with `\n` and writes to `dist/main.css`.
- The array ordering *must* match the `@layer` declaration order in `main.css`. This is the one spot where two sources need to stay in sync.

### Design tokens

All colors use `oklch()`. Example:

```css
:root {
  --color-bg:     oklch(96% 0.012 80);
  --color-text:   oklch(18% 0.02 260);
  --color-accent: oklch(50% 0.05 248);
  /* Fluid type scale via clamp() */
  --text-base: clamp(1rem, 0.96rem + 0.20vw, 1.0625rem);
  /* Spacing (rem, ~1.5 ratio) */
  --space-md: 1rem;
  --space-lg: 1.5rem;
  /* Container */
  --container-max: 75rem;
  --container-padding: clamp(1rem, 5vw, 3rem);
}

[data-theme="dark"] {
  --color-bg:     oklch(14% 0.016 260);
  --color-text:   oklch(92% 0.004 260);
  --color-accent: oklch(70% 0.05 248);
}
```

### Modern CSS features used freely

- **Native nesting** — `.card { & h3 { … } &:hover { … } }`. No Sass needed.
- **`@layer`** — eliminates specificity wars.
- **`oklch()` + `color-mix(in oklch, …)`** — perceptually uniform colors, translucent accents.
- **Logical properties** — `margin-inline`, `padding-block`, `inline-size`, `block-size`.
- **`:has()`** — parent-aware styling where it replaces JS (e.g., `.hero__lead:has(+ .hero__lead)`).
- **Container queries** where component-scoped responsive behavior is needed.
- **`dvh` / `svh` / `lvh`** for viewport sizing.
- **Scroll-driven animations** — `animation-timeline: view()` behind `@supports`, with a JS fallback (see §9.3).
- **`@media (prefers-reduced-motion: reduce)`** is always present where animations exist.

### Theme switching

- `<html>` element carries `data-theme="light"` (default) or `data-theme="dark"`.
- `tokens.css` defines the full palette under `:root` (light), then overrides under `[data-theme="dark"]`, then re-declares light explicitly under `[data-theme="light"]` for symmetry.
- `theme-toggle.ts` flips the attribute and persists to `localStorage`.
- During the swap, `theme-toggle.ts` sets `html.style.transition = "none"` inline, flips the attribute, then clears the inline style in the next `requestAnimationFrame`. This suppresses a flash of animated transitions on every token.

---

## 8. HTML ↔ CSS class-drift lint

`build/lint-classes.ts` is the project's most important invariant enforcement. It prevents the most common failure mode: HTML referencing a class CSS doesn't define, or CSS defining a class no HTML uses.

### What it does

1. Walks `src/styles/*.css` — extracts every class selector (`.foo`) after stripping comments, `url(...)`, `format(...)`, and quoted strings (so a `.woff2` in `url()` doesn't get picked up as a class).
2. Walks `src/templates/**/*.html` recursively — extracts every token inside `class="..."` attributes.
3. Walks `build/pages.ts` — extracts class tokens from template literals there too, because `pages.ts` emits HTML in JS form (e.g., `articleCard`).
4. Computes set difference both directions. Fails the build on either direction.

### Allowlist

A small `JS_APPLIED` set in the lint file lists classes that legitimately don't appear in HTML source:

- **State classes toggled by TS at runtime** — `nav--hidden`, `revealed`, `reveal-pending`.
- **Dormant components** — e.g., carousel classes that the module knows about but no template currently uses.

The allowlist is narrow on purpose. The rule is: "don't add here to unblock the build — fix the drift."

### Why this matters

Class-drift is the single most common regression type across phases. The lint catches it at build time, so it never reaches production. The human-scale prevention (documented in `CLAUDE.md`) is that any phase touching both templates and CSS must enumerate the classes each side expects *before* starting work.

---

## 9. Browser-side TypeScript

### 9.1 Module registry

`src/ts/main.ts` is the entire entry point:

```ts
import { qsa } from './utils/dom';

const moduleRegistry = {
  'theme-toggle':  () => import('./modules/theme-toggle'),
  'nav':           () => import('./modules/nav'),
  'scroll-reveal': () => import('./modules/scroll-reveal'),
  'carousel':      () => import('./modules/carousel'),
} as const satisfies Record<string, () => Promise<{ mount: (el: HTMLElement) => void }>>;

type ModuleName = keyof typeof moduleRegistry;

async function mountModules(): Promise<void> {
  for (const el of qsa<HTMLElement>('[data-module]')) {
    const name = el.dataset['module'];
    if (name === undefined || !(name in moduleRegistry)) continue;
    try {
      const mod = await moduleRegistry[name as ModuleName]();
      mod.mount(el);
    } catch (err) {
      console.error(`[mount] ${name} failed:`, err);  // per-module isolation
    }
  }
}

document.addEventListener('DOMContentLoaded', () => void mountModules());
```

**Contract every module follows:**

- Exports exactly one function: `export function mount(el: HTMLElement): void`.
- Selector into the module is `[data-module="<name>"]`. No ID queries, no class-based mounting.
- Creates one `AbortController` and passes `{ signal }` to every listener, so cleanup is a single `ac.abort()` if ever needed.
- Feature-detects its preconditions (`'IntersectionObserver' in window`, `CSS.supports(...)`) and bails silently if not met.

### 9.2 `utils/dom.ts`

Four typed helpers — the entirety of the DOM abstraction:

```ts
export function qs<T extends Element>(sel: string, parent?: ParentNode): T | null
export function qsa<T extends Element>(sel: string, parent?: ParentNode): T[]
export function on<K extends keyof HTMLElementEventMap>(
  el: EventTarget,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void   // returns cleanup fn
export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Partial<HTMLElementTagNameMap[K]>,
  children?: (Node | string)[],
): HTMLElementTagNameMap[K]
```

Zero runtime overhead beyond the underlying browser APIs.

### 9.3 Scroll-reveal (progressive enhancement example)

This module demonstrates the preferred progressive-enhancement pattern:

1. CSS in `animations.css` handles `[data-reveal]` entirely with `animation-timeline: view()` behind `@supports`.
2. `scroll-reveal.ts` checks `CSS.supports('animation-timeline', 'view()')` on mount. If supported, **it bails out** — CSS does everything.
3. Otherwise it injects a `<style>` tag with fallback rules that reuse the same keyframes, then uses `IntersectionObserver` to add a `.revealed` class.
4. `@media (prefers-reduced-motion: reduce)` branches keep motion-averse users static.

The injected fallback styles are scoped with a unique `id` to make injection idempotent across remounts.

### 9.4 Bundling

- `esbuild.build({ entryPoints: ['src/ts/main.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist/main.js', minify: true, sourcemap: true })`.
- Dynamic imports in the registry are tree-shaken — unused modules drop out. When esbuild bundles a dynamic `import()`, each target becomes a split chunk only if the source asks for splitting; with the above config they're inlined but dead-code-eliminated when a module's key is never queried.
- Loaded via `<script type="module" src="/main.js">` in `base.html`.

---

## 10. Content pipeline

### Markdown frontmatter

Validated at build time — required fields throw with a useful error message referencing the file.

**Article:**
```yaml
---
title: "A Thing I Wrote"
slug: "a-thing-i-wrote"
date: "2026-04-09"
tags: ["typescript", "css"]
description: "One-line summary used in OG tags and card previews."
draft: false
---
```

**Project:**
```yaml
---
title: "My Project"
slug: "my-project"
description: "One-line summary."
tech: ["typescript", "esbuild"]
url: "https://example.com"     # optional
github: "https://github.com/…" # optional
featured: true                 # optional — surfaces on home page
draft: false                   # optional — hides in prod
---
```

### Parse flow (`build/markdown.ts`)

1. `readFile` → `gray-matter` splits frontmatter from body.
2. `parseArticleMeta` / `parseProjectMeta` walks `unknown` data with narrow-typed helpers (`requireString`, `requireStringArray`, `optionalString`, `optionalBoolean`). No `any` anywhere.
3. Word count → `Math.ceil(wordCount / 200)` for a reading-time estimate.
4. `marked(body)` → HTML.
5. `draft: true` entries are filtered in production (`NODE_ENV === 'production'`) but kept in dev so you can preview them.
6. Articles sort by `date` descending; projects keep file order.

### Page generation (`build/pages.ts`)

- Home — latest 3 articles (as `h3` cards) + `featured` projects.
- `/articles/` — all articles as `h2` cards, `.grid-auto` layout.
- `/articles/<slug>/` — one page per article, `article.html` template.
- `/projects/` — all non-draft projects.
- `/projects/<slug>/` — one page per project.
- `/about/` — static about page.

---

## 11. Sitemap + static files

### Sitemap

`build/sitemap.ts` walks the parsed content and writes `dist/sitemap.xml`. Articles use their frontmatter `date` as `<lastmod>` (normalized to `YYYY-MM-DD`); projects omit lastmod. Index pages (`/`, `/articles/`, `/projects/`) are included without lastmod.

### Static files

`build/copy-assets.ts` recursively copies `src/assets/` to `dist/assets/`. Root statics (`favicon.svg`, `favicon.ico`, `robots.txt`) are copied from `src/` to `dist/` if present.

### `robots.txt`

Typical minimal allow-all + sitemap pointer. Kept in `src/` so it's versioned.

---

## 12. Netlify config (`netlify.toml`)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"

[build.processing.html]
  pretty_urls = true         # /articles/slug/ serves index.html

# 1-year immutable cache on hashed/static assets
[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/assets/fonts/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Short TTL for crawl files
[[headers]]
  for = "/sitemap.xml"
  [headers.values]
    Cache-Control = "public, max-age=3600"

# Security headers on everything
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

No wildcard `[[redirects]]` block — a `/*` redirect will rewrite CSS/JS requests to `index.html` and break them. Pretty URLs alone cover the directory-index case.

---

## 13. Porting a Next.js site to this pattern — checklist

A suggested order. Adjust to taste; the underlying rule is "build the lowest-risk pieces first, then layer content in."

1. **Scaffold** — `package.json` with `"type": "module"`, the two tsconfigs, `netlify.toml`, `.gitignore` (ignore `dist/`, `node_modules/`). Add only the devDeps listed in §2.
2. **Strip Next.js concepts that don't apply.** `getStaticProps`, `getServerSideProps`, `app/` routing, `next/image`, `next/link` — all gone. Dynamic routes become a `for` loop that writes files. API routes are either Netlify Functions (outside the scope of this pattern) or removed.
3. **Port pages to templates.** Each Next.js page becomes one `src/templates/<name>.html`. Shared layout → `base.html`. `<Head>` content → `{{title}}`, `{{description}}`, `{{page_url}}` slots in `base.html`.
4. **Port MDX/markdown.** If the Next site uses MDX, move each post to `src/content/articles/*.md`, rewrite JSX components to plain markdown + HTML where possible. If a component was essential, build it into the markdown → HTML pipeline by customizing `marked`'s renderer.
5. **Port CSS.** CSS modules / Tailwind / styled-components → plain CSS in `src/styles/*.css` under the right layer. Replace Tailwind utilities with equivalent `.class` selectors or the design token variables.
6. **Port interactivity.** Each `useEffect` / client component becomes a `src/ts/modules/<name>.ts` exporting `mount(el)`, mounted via `data-module="<name>"` in whatever template needs it.
7. **Build the build pipeline.** Copy `build/*.ts` files in and adjust the content directories, `SITE_ORIGIN`, and `SOCIAL_LINKS`. Run `npm run build` and fix the class-drift errors (there will be some).
8. **Wire up Netlify.** Point Netlify at the GitHub repo; the `netlify.toml` drives the rest.
9. **Verify Lighthouse.** You should hit 100/100 on Performance, Accessibility, Best Practices, SEO without trying. If you don't, the causes are usually: missing `alt` text, missing meta description, oversized unoptimized images, or font-loading without `font-display`.

### Things to watch out for during the port

- **Image optimization.** `next/image` is gone. Replace with `<img width="…" height="…" loading="lazy" decoding="async">` and pre-process images (resize + compress + serve WebP/AVIF) at author time or via a build-time script. Don't skip dimensions — they're what prevents layout shift.
- **Links between pages.** All internal hrefs are trailing-slash URLs like `/articles/` and `/projects/<slug>/`. This matches the file-path routing.
- **Client-side routing.** There isn't any. Every navigation is a full page load. For a personal site this is a feature, not a limitation — cache headers make it near-instant and you get real URLs for free.
- **Env vars / secrets.** There shouldn't be any at runtime. If the Next site uses `process.env.NEXT_PUBLIC_*` for analytics IDs etc., inline them as build-time constants in the TS source or ship them via `<meta>` tags written into `base.html`.
- **Images in markdown.** `marked` turns `![alt](/foo.jpg)` into an `<img>`. If you want lazy loading and dimensions on every markdown image, customize the `marked` renderer in `markdown.ts`.
- **Favicon / OG image.** Both need to exist as static files under `src/` or `src/assets/`. Reference them from `base.html`.

---

## 14. Non-negotiables to carry over

These are the things that keep the pattern coherent — dropping any of them turns it back into a different kind of project.

- **One file per `@layer`** and one layer declaration in `main.css`. No stray unlayered rules.
- **`data-module="<name>"` is the only mount point** for browser TS. No querying by class or ID from `main.ts`.
- **Every interactive module exports `mount(el: HTMLElement)` and nothing else.** One entry, one contract.
- **`AbortController` + `{ signal }` on every listener.**
- **Class-drift lint must stay in the build pipeline.** It's the only thing stopping CSS/HTML divergence.
- **Modern TS + modern CSS is fair game.** "Conservative" targets runtime deps, not language features. Don't downlevel.
- **Progressive enhancement over polyfills.** `@supports`, `CSS.supports`, `'X' in window` — if a feature's missing, degrade gracefully.
- **Build-time over runtime.** If something can be computed when generating HTML, compute it then. The runtime ships nothing it doesn't need.

---

## 15. Reference counts (this site, as of writing)

- **Runtime deps:** 0
- **Dev deps:** 6 (esbuild, gray-matter, marked, tsx, typescript, @types/node)
- **Browser JS modules:** 4 (nav, theme-toggle, scroll-reveal, carousel)
- **CSS layers:** 7
- **Templates:** 7
- **Build steps:** 8 (prod), ~5 (dev)
- **Lines of build code:** ~600
- **Lines of browser TS:** ~300
