# matt-site progress

## Phase checklist
- [x] Phase 0 — Meta setup (CLAUDE.md, subagents, slash commands, docs/)
- [x] Phase 1 — Scaffold & config
- [x] Phase 2 — Build system
- [x] Phase 3 — CSS architecture
- [x] Phase 4 — TypeScript interactive modules
- [x] Phase 5 — Content & templates
- [x] Phase 6 — Integration, polish, deploy

## Last session — 2026-06-30 (multi-dossier generalize pass + TOC fix)

**Context:** Continuation of the 2026-06-29 two-tier-header prototype. Matt chose
"full pass." Branch `feat/multi-dossier-two-tier-header`. Build green throughout
(`npm run build` — typecheck + lint-classes clean, 21 pages). Not pushed/deployed.

**Done — TOC clip fix (the flagged bug):**
- `.ms-toc` sticky offset no longer hardcoded for the old single-row header. The
  nav module (`src/ts/modules/nav.ts`, already mounted on `.site-header`) now
  measures `el.offsetHeight` and publishes `--site-header-height` on `:root`
  (re-measured on resize + after `document.fonts.ready`). `.ms-toc` desktop rule
  (`src/styles/missing-scientists.css`) reads it: `inset-block-start: calc(var(--site-header-height, 6rem) + var(--space-md))`
  and a matching `max-block-size`. `6rem` fallback covers pre-hydration/no-JS.
  Self-corrects through future header changes instead of needing a re-tune.

**Done — generalize pass (items 1–3; item 4 table redesign still deferred):**
- **Namespacing:** MS now served under `/missing-scientists/`. Global `BASE`
  removed; each dossier carries its own `base`. `data-src` in the diagram/timeline
  templates is `{{base}}/data/…` + new `data-base="{{base}}"`; the D3 modules read
  `el.dataset['base']` (module-level `let base`) instead of `const BASE = ''`.
  `ms-page.html` back-link and diagram/timeline noscript/back links are `{{base}}`-aware.
- **`dossiers[]` registry** in `build/site.config.ts` (`Dossier` interface:
  base/label/name/tagline/blurb/status/sections/researchPath). `missing-scientists.ts`
  is now a generic `generateDossier(d)` looping the registry; Tier-2 label/sections
  come from the entry.
- **Umbrella landing at `/`** (`src/templates/umbrella.html`, `generateUmbrellaLanding()`)
  — dossier directory, cards from the registry, only shown if the research repo is
  present. Reuses existing `.hero`/`.card`/`.grid-auto`/`.tag` → no new CSS.
- **Shared Tier-1 pages** Methodology + About generated once at root (from
  `primaryDossier`), no Tier-2 bar. `postProcess` rewrites README/logs links to
  root `/methodology/` `/transparency/`, case/analysis links to the dossier base.
- `netlify.toml`: 301s for old root section URLs (`/cases/*` etc. → `/missing-scientists/…`).
- Refreshed stale `build/MISSING-SCIENTISTS.md`.

**Known limitation:** the per-dossier generator still assumes the MS *content shape*
(cases/analysis/sources/glossary/tier-badges). Routing + identity are registry-driven,
but a differently-structured second dossier needs the generator extended.

**Not done / deferred:** item 4 (table redesign — prose-breakout grid). Header chrome
design left as-is per Matt ("a bit confusing, workable" — still reviewing). Default OG
image still renders `siteName` ("The Missing Scientists") via `generate-images.ts`;
arguably should be the umbrella brand now. `.claude/` (agents/skills/launch.json) is
untracked project tooling — left uncommitted (unrelated to this feature).

## Last session — 2026-06-29 (multi-dossier rebrand: two-tier header, prototype)

**Context:** Matt wants the site to host *multiple* dossiers, with "Missing Scientists" as
one of them. The repo/site was hardcoded to the single dossier. Working umbrella brand:
**"Anomaly Dossiers"** (placeholder — not final). Approach agreed: prototype the two-tier
header on the existing single-dossier setup first, then generalize. Table redesign deferred.

**Done (two-tier header chrome, MS still served at root):**
- `build/site.config.ts` — added `brandName` ("Anomaly Dossiers") + `brandTagline` as the
  umbrella identity, separate from `siteName` ("The Missing Scientists", the active dossier).
  Swap `brandName` when the real name is settled.
- **Tier 1 (brand bar):** `base.html` header now leads with `ANOMALY DOSSIERS` → `/`, plus
  the genuinely shared links (Dossiers / Methodology / About) + theme toggle. Footer colophon
  switched `{{site_name}}` → `{{brand_name}}`.
- **Tier 2 (dossier bar):** new `{{dossier_nav}}` slot rendered into the sticky header by
  `generateDossierBar()` in `build/missing-scientists.ts` — shows `MISSING SCIENTISTS ·` label
  + the dossier's internal sections (Overview/Diagram/Timeline/Connections/Hypotheses/Foreign
  Intel/Sources) with active-section highlighting. Methodology + Transparency graduated up to
  Tier 1 as shared pages, so they were dropped from `NAV_ITEMS`.
- Removed the now-redundant in-content `{{ms_nav}}` from `ms-page.html`, `ms-diagram.html`,
  `ms-timeline.html` (it moved into the header).
- CSS: new `.site-brandbar`, `.dossier-bar`, `.dossier-bar__label` in `nav.css`; retargeted the
  header grid rule in `layout.css` from `.site-header .container` → `.site-brandbar .container`
  (the header now holds two `.container`s). `.dossier-bar .ms-nav` strips the in-article
  border/margins and reuses the horizontal-scroll behaviour.
- `npm run build` passes (typecheck + lint-classes clean, 20 pages).

**KNOWN ISSUE flagged by Matt (investigate next):** the left TOC pane (`.ms-toc`) "isn't
rendering" properly. Prime suspect: the header is now **two rows tall**, but `.ms-toc`'s sticky
offset is hardcoded `inset-block-start: 5rem` (and `max-block-size: calc(100dvh - 6rem)`) tuned
for the old single-row header — likely tucks under / clips behind the taller header at ≥64rem.
Check header height vs. those offsets first. (TOC pipeline itself — `addHeadingIds` → `{{toc}}`
— was not touched this session.) Matt's read: "header is a bit confusing however, workable, decent start."

**Still to do — the "generalize" pass:**
1. Namespace MS under `/missing-scientists/` (flip `BASE` in `site.config.ts`). Breaks two
   hardcoded-root spots that must move with it: the `data-src="/data/..."` attrs in
   `ms-diagram.html`/`ms-timeline.html`, and the `const BASE = ''` in `ms-diagram.ts`/
   `ms-timeline.ts` (used for case-link `window.location.href`).
2. Real umbrella landing at `/` (a dossier directory) instead of the MS overview.
3. A `dossiers[]` registry in config so Tier-2 sections + dossier label aren't hardcoded;
   turn `missing-scientists.ts` into a generic per-dossier generator that loops it.
4. Table redesign (prose-breakout grid — let tables/diagrams escape the 75ch measure). Deferred.

## Last session — 2026-04-23 (redacted click-to-reveal fix + mobile layout fixes)
- Fixed redacted censor bar click-to-reveal: replaced stuck-open `:focus-visible`/`:focus-within` CSS reveal with a JS click-triggered 600ms peek animation that returns to hidden state (`src/styles/components.css`, `src/ts/main.ts`).
- Fixed redacted bar dark mode: reverted from `var(--color-text)`/`var(--color-bg)` tokens to fixed ink colors (`oklch(11% 0.015 260)` bar, `oklch(97% 0.004 80)` revealed text) so bar stays dark in both themes.
- Removed `tabindex="0"` from redacted spans in `build/markdown.ts` since focus-based reveal is no longer used.
- Added `redacted--peeking` to `JS_APPLIED` allowlist in `build/lint-classes.ts`.
- Fixed Missing Scientists dossier mobile overflow: `.ms-layout` grid changed from `1fr` to `minmax(0, 1fr)`, added `min-inline-size: 0` to `.ms-prose` (`src/styles/missing-scientists.css`).
- Used document-level event delegation for the redacted click handler in `src/ts/main.ts` (spans have no single wrapper mount point).

## Next session
Test the deployed redacted peek animation and dossier mobile layout on an actual phone to confirm fixes work as expected. Then pick up the glossary/reference page todo (acronyms and locations of interest — decide where it lives in the site hierarchy) or other polish items.

## Open questions
- When to flip `noindex` → `index, follow` and add MS to sitemap (deferred per task spec).
- SEO framing for the dossier before indexing.
- Branch scope drift: `feat/ms-mobile-tables` (now `feat/pre-push-safeguard`) contains unrelated work. Before merging/PR, consider rebasing or squash-merging cleanly onto main.
- Glossary/reference page for acronyms and locations of interest in the Missing Scientists dossier — where in the site hierarchy should it live?
- Tables still touch the right edge on some intermediate display sizes — may need Playwright testing to confirm.
- `<hr>` alignment on missing-scientists pages on mobile not yet addressed.
- Mobile TOC overlay not tested on actual devices.
- Addendum wording on `cortex-agents.md` is a first pass — Matt should edit to taste before deploy.
- `--container-padding` is the correct padding token for viewport-edge calculations on missing-scientists pages, not `--space-md`. Earlier table wrapper used `--space-md`; updated this session.
- `src/content/projects/mcp-snowflake.md` has placeholder body prose. When Matt is ready to build a real project here, flip `draft: false` (or delete the file and start fresh).
- Immutable cache (`Cache-Control: public, max-age=31536000, immutable`) is set on `/*.css` and `/*.js` in `netlify.toml`, but esbuild emits `main.css`/`main.js` without content hashes. Returning visitors will see stale assets for up to a year after a redeploy. Fix: content-hashed filenames (ripples into `base.html` slot) or shorter TTL. Decision deferred to Matt.
- `--color-text-muted` in light mode (`oklch(45% 0.018 260)` on `oklch(96% 0.012 80)`) is ~4.2:1 — passes AA for large text, near-fails for small body text. Needs a real WCAG contrast-checker pass before deploy.
- Optional: `<link rel="apple-touch-icon">` not present. Non-blocking; add a 180×180 PNG to root statics if iOS home-screen support is wanted.
- `components.css` is ~600 lines. Plan to split by component file (cards, buttons, nav-related, carousel, etc.). Deferred for a dedicated refactor session.
- `theme-toggle.ts` uses `html.style.setProperty('transition', 'none')` + rAF instead of `classList.add/remove('.no-transition')`. Should migrate for consistency; would let `.no-transition` be removed from the lint allowlist.
- Carousel infrastructure (`.carousel-wrapper`, `.carousel-track`, `.carousel-slide`, `src/ts/modules/carousel.ts`) is dormant — no template uses `[data-module="carousel"]`. Decision needed: keep as ready-to-use OR strip as YAGNI. Same question for `.stagger-1..4` animation delay utilities.
- Dev server moved to port 3001 (`build/build.ts`). If 3001 is in use, the same zombie-watcher problem from port 3000 applies — kill the first process before starting a second dev session.
- `matt-beach.png` deletion was not committed at session end — verify it is staged and commit in the next session if not already done.
- `npm run build` does not set `NODE_ENV=production`, so the `isProd` gate in `build/markdown.ts` never fires. Decide: wire `NODE_ENV=production` into the `build` script, or drop the gate. Until resolved, the projects-list filter in `build/pages.ts` is the only reliable draft suppression mechanism.
- `main { padding-block: var(--space-md); }` in `src/styles/layout.css:20` contributes `space-md` above the hero on mobile. Deferred — affects every page including articles.

## Blockers
- (none)

