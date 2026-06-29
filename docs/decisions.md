# matt-site decisions log

ADR-lite. Each entry is a dated decision with context, the choice made, and consequences. The `progress-tracker` subagent appends to this file at the end of sessions where a non-obvious decision was made. Do not hand-edit during work sessions.

Only log decisions that are **non-obvious or reversible**. "We used TypeScript" is not decision-worthy. "We rejected Shiki in favor of no syntax highlighting for Phase 1 to shorten the critical path" is.

---

## 2026-04-09 — Use Claude Code subagents for domain isolation, not parallelism
**Context:** Matt is new to Claude Code and wanted to try subagents on this project. The 6-prompt build chain could be run as one big session or as 6 sessions with specialized subagents per domain.
**Decision:** Six specialist subagents (`build-specialist`, `css-specialist`, `ts-specialist`, `content-specialist`, `reviewer`, `progress-tracker`) scoped to single directories with forbidden-directory rules. Phases run sequentially, one per Claude Code session.
**Consequences:** Enforces separation of concerns via tooling, not discipline — the CSS agent cannot touch TypeScript because its system prompt forbids it and its tool access is narrow. Cost: more files to maintain in `.claude/agents/`. Benefit: future phases stay clean even when the main context is deep.

## 2026-04-09 — In-repo docs/ + memory pointers for growing context
**Context:** Need a persistent, growing knowledge base + progress tracker that survives session boundaries without bloating active context.
**Decision:** Source of truth is `docs/progress.md`, `docs/knowledge-base.md`, `docs/decisions.md` committed to the repo. Claude Code memory (`~/.claude/projects/.../memory/`) holds only pointers telling future sessions to read these files.
**Consequences:** Docs are portable (GitHub-visible, machine-transferable, greppable, version-controlled). Memory stays small and focused. Cost: the workflow depends on `/end-session` being run religiously — if it's skipped, `progress.md` drifts from reality.

## 2026-04-09 — Package manager: npm over yarn
**Context:** The project has ~6 devDeps. Choosing between npm and yarn (Classic vs Berry) before any install.
**Decision:** npm.
**Consequences:** Node 22 npm is fast enough for this tree size. Yarn Berry vs Classic is extra cognitive load with no payoff here. Netlify defaults to npm, so staying on npm avoids one config drift risk. If the dep tree grows substantially, revisit.

## 2026-04-09 — Single `dev` script entry point, flag-based
**Context:** Phase 2 needs a dev server (esbuild `ctx.serve()` + `ctx.watch()`) in addition to the production build path.
**Decision:** `dev` script is `tsx build/build.ts --dev`. No separate `build/dev.ts`. Phase 2 will branch on the `--dev` flag inside `build/build.ts`.
**Consequences:** One entry point to maintain. The flag-check is a small amount of branching logic inside `build.ts`. Rules out a clean `dev.ts` / `build.ts` separation if the two paths ever diverge significantly — acceptable trade-off for now.

## 2026-04-09 — `build` script gates on typecheck
**Context:** The production build script needs to not ship type errors silently.
**Decision:** `"build": "tsc --noEmit && tsx build/build.ts"`. Typecheck must pass before esbuild runs.
**Consequences:** Production builds fail fast on type errors. Local `npm run build` is slightly slower than `tsx build/build.ts` alone. `npm run typecheck` is still available as the standalone check.

## 2026-04-09 — Single-agent scaffold pass for Phase 1
**Context:** CLAUDE.md enforces strict directory ownership (4 specialists own `src/styles/`, `src/ts/`, `src/templates/`, `src/content/` respectively). Phase 1 only creates empty stubs in those directories.
**Decision:** `build-specialist` took the full Phase 1 skeleton in one pass, including empty stubs in other specialists' directories.
**Consequences:** Pragmatic for Phase 1 since writing empty `.gitkeep` files and HTML shells doesn't constitute real domain work. Real code in those directories starts in Phases 3–5 and must go through the correct specialist. Sets a precedent to watch — do not let this pattern bleed into phases where real code is written.

## 2026-04-09 — `noEmit: true` duplicated in `tsconfig.build.json`
**Context:** `tsconfig.build.json` extends root `tsconfig.json` which already sets `noEmit: true`. The field was explicitly repeated in the extended config.
**Decision:** Keep the explicit duplication.
**Consequences:** Protects against accidental emit if someone edits the base config later and removes `noEmit`. Slight redundancy is worth the safety. No other consequences.

## 2026-04-09 — `pretty_urls` + `[[redirects]]` fallback in `netlify.toml` (deferred review)
**Context:** `netlify.toml` has both `pretty_urls = true` under `[build.processing]` and a `[[redirects]]` catch-all rule. These may be redundant.
**Decision:** Leave both in for now. Deferred trimming to Phase 6 polish once we can test routing on a real deploy.
**Consequences:** Possible redundant config with no runtime harm. Must revisit in Phase 6 or first deploy.

## 2026-04-09 — Defer syntax highlighting (Shiki) until after Phase 1 ships
**Context:** The original outline doesn't include syntax highlighting for code blocks in articles. Shiki would do this at build time (zero client JS) with ~10 lines of code in `build/markdown.ts`.
**Decision:** Leave it out of Phases 1-6. Add it as the first post-launch enhancement once the rest of the site is live.
**Consequences:** Code blocks in early articles render as flat monospace text — readable but visually plain. Easy to add later without touching any other code. No rush.

## 2026-04-09 — Production sourcemaps always on
**Context:** Phase 2 prompt listed sourcemap as a core esbuild option alongside minify, but the `--dev` flag bullet read as dev-only enablement. Ambiguous spec.
**Decision:** Sourcemaps on in both dev and prod (`build/build.ts` calls `stepJs` with sourcemap=true unconditionally).
**Consequences:** This is a personal site with a public GitHub repo — the "information disclosure" tradeoff is zero. Prod debugging gets real file/line numbers instead of `main.js:1:N`. Adds a few KB to each Netlify deploy. Do not reconsider unless the codebase becomes proprietary.

## 2026-04-09 — Stub detection in templates and CSS concat for phase-gated builds
**Context:** Phase 1 left comment-only HTML templates and `/* */`-only CSS partials as placeholders. Running the Phase 2 build against them would either crash or emit empty pages.
**Decision:** `build/templates.ts` treats any template whose content is an HTML comment with no `{{slot}}` markers as not-yet-implemented and skips page generation. `concatCss` skips CSS files whose trimmed content starts with `/*`.
**Consequences:** The build pipeline runs green against Phase 1 empty shells. Phases 3 and 5 will be picked up automatically once real content replaces the stubs — no build changes needed. Watch for accidentally skipping a file that should be included but looks like a stub.

## 2026-04-09 — Dual watcher strategy for dev server (esbuild + node:fs.watch)
**Context:** esbuild's `ctx.serve()` + `ctx.watch()` handles JS/CSS bundling incrementally, but markdown and HTML template changes require a full pages rebuild that esbuild cannot express natively.
**Decision:** Two watchers in `build/build.ts`: esbuild's for JS/CSS, and `node:fs.watch` scoped by file extension for markdown/HTML/CSS triggers that call the relevant build step directly.
**Consequences:** Scoped rebuilds without over-rebuilding (CSS change → CSS step only, `.md` change → pages step only). The two watchers are independent — if esbuild's watcher fires a CSS rebuild at the same time as the `fs.watch` CSS trigger, both may run concurrently. Acceptable for a personal site with no concurrent editors.

## 2026-04-09 — Main agent made one-line sourcemap edit directly (bypassing build-specialist)
**Context:** After `reviewer` flagged the sourcemap issue, `SendMessage` to the warm build-specialist was not available in this harness. Spawning a fresh subagent to flip one boolean would cold-start a full context load.
**Decision:** Main agent edited `build/build.ts:95` directly after explicit user approval.
**Consequences:** One-off exception. Does not change the directory ownership rule going forward. Any future edits to `build/` must go through `build-specialist`.

## 2026-04-09 — "Workshop at Night" amber-orange palette (hue ~55) over purple/teal defaults
**Context:** CLAUDE.md mandates a distinctive, non-generic color palette. Purple gradients and teal are the two most common defaults for developer personal sites.
**Decision:** Amber-orange accent at `oklch(68% 0.18 55)` (light) / `oklch(72% 0.18 58)` (dark), on warm cream (light mode) and cool near-black slate (dark mode). All colors expressed as `oklch()` or `color-mix(in oklch, …)`.
**Consequences:** Palette reads warm and direct without reading corporate. Commits future CSS work to staying within oklch — no hex or rgb fallbacks. Palette has not yet been reviewed in a real browser; may be adjusted before Phase 6.

## 2026-04-09 — Fraunces as heading font
**Context:** Needed a heading font with editorial personality that is not on the banned list (Inter, Roboto, Space Grotesk). Fraunces is a variable optical-size serif with a quirky display personality.
**Decision:** Fraunces for all headings, loaded via `@font-face` from Google CDN with `unicode-range`. Body text stays in the system-ui stack.
**Consequences:** Adds one external CDN request per page load (mitigated by `font-display: swap` and Google's CDN performance). Commits the typographic identity of the site to a serif display font for headings. Self-hosting path documented in knowledge base if needed.

## 2026-04-09 — `--color-on-accent` as a fixed non-theme-flipping token
**Context:** The amber accent background is the same hue in both light and dark modes. Button text on that background must be dark in both modes.
**Decision:** `--color-on-accent` is defined as a fixed dark value in `:root` and is not overridden in `prefers-color-scheme: dark`. It does not reference `--color-bg`.
**Consequences:** Any future color scheme refactors must not naively map all foreground/background tokens through the dark-mode swap — accent-on tokens are a separate category that must be reviewed independently.

## 2026-04-09 — `@layer components` shared across `nav.css` and `components.css`
**Context:** Nav and card/component styles are authored in separate files but both belong semantically in the components layer of the cascade.
**Decision:** Both files write into `@layer components { … }`. The CSS cascade merges same-named layer blocks in source order.
**Consequences:** The split is purely organizational — to a browser there is one `components` layer. Future maintainers must know this is intentional; it is not a mistake or a naming collision.

## 2026-04-09 — One `!important` accepted in `animations.css` inside `prefers-reduced-motion`
**Context:** The project's CSS rules prohibit `!important`. The `prefers-reduced-motion: reduce` override block needs to defeat any inline or JS-set animation values that may have already been applied.
**Decision:** Allow a single `!important` exception inside `@media (prefers-reduced-motion: reduce)` in `src/styles/animations.css`. This is the established a11y pattern for motion overrides.
**Consequences:** Creates a documented exception to the no-`!important` rule. Future CSS authors must not use this as a precedent for general-purpose `!important` usage — it applies only to accessibility motion overrides.

## 2026-04-09 — Module registry pattern: `as const satisfies Record<string, () => Promise<{ mount: ... }>>`
**Context:** `src/ts/main.ts` needs a map of module name → dynamic import factory so `[data-module]` attribute values resolve to the right import at runtime.
**Decision:** Use `as const satisfies Record<string, () => Promise<{ mount: (el: HTMLElement) => void }>>` for the registry object literal.
**Consequences:** `as const` preserves literal key types so TypeScript can verify that a given `data-module` value is a known key. `satisfies` validates the shape without widening to the broader type. Adding a new module requires one line in the registry; the rest of `main.ts` stays unchanged.

## 2026-04-09 — JS-side `<style>` injection in `carousel.ts` and `scroll-reveal.ts` (temporary)
**Context:** Phase 4 required `.carousel-*`, `.reveal-fade-up`, `.reveal-fade-in`, `.reveal-scale-in`, `.revealed`, and `.no-transition` classes. Phase 3 CSS did not define them. Blocking Phase 4 on a CSS pass would merge phases.
**Decision:** `carousel.ts` and `scroll-reveal.ts` inject a `<style>` element at mount time containing the minimum required CSS. This is an explicit temporary workaround.
**Consequences:** Style definitions are split between CSS partials and JS strings. Must be resolved before or during Phase 5: `css-specialist` adds the missing partials, JS modules remove the injection. If not cleaned up, future CSS changes to those classes must be made in two places.

## 2026-04-09 — `scroll-reveal` early-exit when native scroll-driven animations are supported
**Context:** Phase 3 defined a native CSS scroll-driven reveal path behind `@supports (animation-timeline: view())`. Phase 4's JS fallback would redundantly add reveal classes on modern browsers that already handle it via CSS.
**Decision:** `scroll-reveal.ts` calls `CSS.supports('animation-timeline', 'view()')` at mount time and returns immediately if true — the native CSS path wins.
**Consequences:** On modern browsers (Chrome 115+, Safari 18+), `scroll-reveal.ts` is a no-op module. The JS path only runs on browsers that lack native support. This means the JS fallback code is exercised only in testing on older browsers — it must be verified there separately.

## 2026-04-09 — Theme-toggle transition flash suppression via inline style + rAF, not a class
**Context:** `theme-toggle.ts` needs to suppress transition animation during theme switches. The `.no-transition` class was planned but not yet in CSS.
**Decision:** `theme-toggle.ts` sets `html.style.setProperty('transition', 'none')` directly and removes it inside a `requestAnimationFrame` callback, bypassing the missing CSS class.
**Consequences:** Works without CSS cooperation. If `.no-transition` is later added to CSS, this inline style approach should be replaced with the class toggle for consistency with the rest of the codebase.

## 2026-04-09 — `data-reveal="fade-up"` as unified vocabulary for templates (partial fix)
**Context:** Phase 3 native CSS used `data-reveal="slide"` and Phase 4 JS fallback used `data-reveal="fade-up"`. Templates needed one safe value to use across both paths.
**Decision:** Alias `[data-reveal="fade-up"]` onto the native CSS `slide` rule via a selector addition in `src/styles/animations.css`. Templates use only `fade-up`. Full vocabulary reconciliation (covering `fade-in`, `scale-in`, `slide`, `scale`) deferred to Phase 6.
**Consequences:** `fade-up` is the only safe `data-reveal` value for new templates until Phase 6. The other four values remain split across paths. The aliasing approach adds one selector per native rule — cheap, but tech debt until the full reconciliation lands.

## 2026-04-09 — Kept content-specialist's full-prose articles; rule change is prospective only
**Context:** `content-specialist` wrote ~1800 words of real prose for the two articles and two projects, driven by the Phase 5 prompt spec ("write as Matt, authentic voice"). CLAUDE.md's "no lorem ipsum" rule was ambiguous about scaffolding vs. deploy-ready content.
**Decision:** Keep the existing prose as-is per Matt's direction. Update `CLAUDE.md` and `docs/prompts/05-content.md` prospectively to clarify that "no lorem ipsum" applies to deploy-ready content only; scaffolding should use labeled lorem ipsum.
**Consequences:** Current articles contain Claude-written prose that should be replaced by Matt before deploy. The rule clarification prevents the same ambiguity in future phases.

## 2026-04-09 — `SITE_ORIGIN = "https://mattnoth.dev"` in `build/pages.ts`
**Context:** `og:url` meta tag required a canonical absolute URL per page. No existing constant in `build/` or `netlify.toml` held the origin.
**Decision:** Add `SITE_ORIGIN = "https://mattnoth.dev"` as a named constant in `build/pages.ts`. Value matches the `mattnoth` handle already used in `base.html` social links.
**Consequences:** If the domain changes, this constant and the social link in `base.html` must both be updated. There is currently no single source of truth — two places to update on a domain change.

## 2026-04-09 — Separate `page_title` and `title` slots instead of stripping suffix at template side
**Context:** Browser `<title>` and `og:title` needed the suffixed form ("Article — Matt Noth"), but the `<h1>` needed only the raw title. Originally both used the `title` slot, requiring templates to strip the suffix — invisible coupling.
**Decision:** Two slots: `title` (suffixed, for `<title>` and OG tags) and `page_title` (raw, for `<h1>`). Both are produced by `build/pages.ts` and consumed by the appropriate template locations.
**Consequences:** Adding a new page type requires populating both slots. Eliminates the strip-suffix antipattern at the template side. If the suffix format ever changes, only `pages.ts` needs to change.

## 2026-04-09 — "Phase execution rules" added to `CLAUDE.md` rather than a separate process doc
**Context:** Phase 5 orchestration gaps (missing CSS class constraint, no slot pre-flight, unreconciled vocabulary drift) were the session's main cost center. The lessons needed to be codified somewhere that is always in main-agent context.
**Decision:** New "Phase execution rules" section added directly to `CLAUDE.md` instead of a separate file under `docs/`.
**Consequences:** Rules are in context at every session start via `CLAUDE.md` automatic load. A separate doc would be missed during phase starts unless explicitly read. Adds length to an already long `CLAUDE.md` — acceptable trade-off.

## 2026-04-09 — Removed `slide`/`scale` `data-reveal` aliases rather than keeping them deprecated
**Context:** Phase 6 vocabulary reconciliation found that `slide` and `scale` appeared only in `src/styles/animations.css` — not in any template, content file, or JS module's `VALID_VARIANTS` set. The Phase 5 decision had aliased `fade-up` onto the native `slide` rule as a partial fix.
**Decision:** Remove `slide` and `scale` outright. Final canonical vocabulary: `fade-up | fade-in | scale-in`. All three values work on both the native CSS path and the JS fallback path.
**Consequences:** Any external content that used `data-reveal="slide"` or `data-reveal="scale"` will silently get no animation. Since no templates or content files used them, this is zero-risk today. If the vocabulary is ever extended again, the same audit (CSS + JS `VALID_VARIANTS` + templates + content files) must all agree before shipping.

## 2026-04-09 — Parameterized `HeadingLevel` on card functions instead of flattening home-page sections
**Context:** Phase 6 reviewer flagged a heading-hierarchy bug: home page emits `h2` section headings and `h2` card headings at the same level — screen readers see a flat list with no nesting. Options were: (a) flatten all section `h2`s to `<p>` labels, or (b) parameterize the card heading level.
**Decision:** `articleCard` and `projectCard` in `build/pages.ts` accept a `HeadingLevel` parameter. Home page passes `'h3'` (cards nest under section `h2`); list pages pass `'h2'` (cards nest under page `h1`). All `.map()` call sites converted to explicit arrow functions to avoid the positional-argument footgun.
**Consequences:** Adding a new call site for either card function requires explicitly choosing a heading level — no silent default. Heading semantics are now correct on both home and list pages without touching templates.

## 2026-04-09 — Card CSS rewritten to match HTML, not HTML to match CSS
**Context:** Post-Phase 6 card layout was broken. `components.css` defined `.card__body`, `.card__title`, `.card__description`, `.card__tags`, `.card__image`, `.card__meta`, and a full `.project-card` block. The HTML emitted by `build/pages.ts` used `<header>`, `<p>`, `<div class="tags">` as direct children of `.card` — no BEM child classes.
**Decision:** Rewrote card CSS rules to target the actual emitted HTML structure (`.card header`, `.card p`, `.card .tags`). Deleted all BEM child-class selectors and the `.project-card` block entirely. Did not change the HTML to match the BEM vocabulary.
**Consequences:** BEM child-class vocabulary for cards is gone. The HTML producer (`build/pages.ts` template literals) is the de-facto contract, per CLAUDE.md preference for styling what ships. Future card styling must use the element-selector or modifier-class pattern. The `build/lint-classes.ts` step will catch any future drift immediately.

## 2026-04-09 — Class-lint fails on both directions of drift, not just missing-in-CSS
**Context:** The card-class drift bug was in the unused-in-HTML direction (CSS had classes that no HTML emitted). A lint that only checked "class in HTML but not in CSS" would have missed it entirely.
**Decision:** `build/lint-classes.ts` fails on asymmetry in BOTH directions: (1) class emitted by HTML not found in CSS, and (2) CSS class selector not found in any emitted HTML. The `JS_APPLIED` allowlist covers intentionally dormant infrastructure.
**Consequences:** CSS authors cannot add new rules without a corresponding HTML consumer — or an explicit allowlist entry. This is intentional: silent dead CSS was the root cause of this session's bug. Allowlist entries for dormant infrastructure require a comment naming why they are dormant.

## 2026-04-09 — `date` frontmatter field = publish date, not original writing date
**Context:** `cortex-agents.md` was originally written in January 2026 but added to the site on 2026-04-09. Matt did not want to backdate the publish date or "embellish" the release date.
**Decision:** Keep `date: 2026-04-09` as the canonical publish date. Add a plain-language editor's-note addendum in the article body noting original writing was January 2026.
**Consequences:** The article card in listings shows "Apr 9, 2026" while the body says "originally written January 2026". Acknowledged inconsistency; the addendum handles the nuance. If the site later adds an `originally_written` frontmatter field for display, this article is the first candidate.

## 2026-04-09 — Deleted ghostwritten articles/projects rather than drafting or rewriting
**Context:** `building-this-site.md`, `modern-css-is-amazing.md`, and `context-base.md` were written by `content-specialist` in Phase 5 in Matt's first-person voice. Matt's feedback: the learnings they contained were Claude's, not Matt's.
**Decision:** Delete all three files outright. The learnings already live in `docs/knowledge-base.md`. `context-base` additionally has no clean-room codebase to point at — only Matt's work version.
**Consequences:** The site launches with one real article (`cortex-agents`) and a near-empty Projects section. Leaving them with `draft: true` was rejected because it keeps misattributed prose in the repo. One substantive real article fits the white-paper positioning better than one real + two ghostwritten fillers.

## 2026-04-09 — Card clickability via stretched `::after` overlay, not wrapping `<a>`
**Context:** Cards needed to be fully clickable surfaces. Wrapping the entire card in an `<a>` would create nested interactive elements (project cards have Live/GitHub links inside), which is invalid HTML.
**Decision:** Title anchor gets a stretched `::after { content: ""; position: absolute; inset: 0; border-radius: inherit }` overlay. `.card` gets `position: relative`. Secondary interactive elements (`.card .links`) escape the overlay via `position: relative; z-index: 1`.
**Consequences:** Keeps semantic HTML (single real anchor per card), accessibility (one title link announced by screen readers), and correct middle-click/right-click/copy-link behavior. Text-caret placement via single click on the card body is blocked — standard tradeoff of this pattern. No new CSS classes introduced; lint count unchanged at 34 HTML / 49 CSS.

## 2026-04-09 — Section-spacing collapse via `.section + .section`, not global `padding-block` adjustment
**Context:** Consecutive sections on the home page had too much vertical gap between them, but adjusting `.section { padding-block }` globally would have also shrunk the first section's top spacing (after the hero) and the last section's bottom spacing (before the footer).
**Decision:** Add `.section + .section { padding-block-start: var(--space-xl) }` as a nested rule in `src/styles/layout.css`. Adjacent-sibling selector collapses only the space between sections, leaving first and last intact.
**Consequences:** The selector is precise. Adding a non-`.section` element between two sections (e.g. a full-bleed band) would stop the collapse from applying — intentional. Future sections added to the home page automatically inherit the collapsed gap without any extra CSS.

## 2026-04-09 — `.section` as flex column with single gap token for section rhythm
**Context:** Home page section rhythm (h2 → cards grid → trailing "more →" link) had been managed with per-element margins. Inconsistent spacing; required multiple rules to adjust.
**Decision:** `.section` in `src/styles/layout.css` is `display: flex; flex-direction: column; gap: var(--space-lg)`. Single gap token controls all spacing between direct children.
**Consequences:** Section rhythm is one token. Changing `--space-lg` or the section gap affects h2→grid and grid→trailing-link simultaneously. Adding a third direct child (e.g. a filter bar) automatically inherits the gap. Overriding spacing on individual children requires a scoped margin that explains why it's special.

## 2026-04-09 — Trailing "more →" links styled via `.section > p:last-child`, no new class
**Context:** Home page has "All articles →" and "All projects →" trailing links below each card grid. Options: (a) add a new class to the template and lint allowlist, (b) use a structural selector.
**Decision:** Style via `.section > p:last-child` in `src/styles/layout.css`. No template change, no new vocabulary for the class-lint to police.
**Consequences:** Selector is structural — it targets any `<p>` that is the last direct child of `.section`. Adding a second trailing paragraph to a section would style both as "more" links. Acceptable for this site's template structure; would need a named class if sections ever get more complex trailing content.

## 2026-04-10 — `minmax(0, 1fr)` on body grid rather than `overflow: hidden` on a child
**Context:** Body grid was emitting an implicit auto column, causing horizontal page overflow when wide content (code blocks, tables) landed in the Cortex Agents article. Two remedies considered: fix the grid track sizing at root, or add `overflow: hidden` (or `overflow-x: clip`) on `<main>`.
**Decision:** Add `grid-template-columns: minmax(0, 1fr)` to `body` in `src/styles/layout.css`. Addresses the root cause at the grid container rather than masking it at a descendant.
**Consequences:** All direct children of the body grid are constrained to the viewport width by the `minmax(0, ...)` floor. Any future grid layout on `body` that omits columns should get the same treatment. `overflow: hidden` was rejected because it would clip sticky headers, tooltips, or any position-absolute elements that intentionally extend beyond the main column.

## 2026-04-10 — Smaller JPG over full PNG for about photo
**Context:** Two versions of the beach photo existed in `src/assets/images/`: `matt-beach.png` (651KB) and `matt-beach-jpg-smaller.jpg` (347KB). Same perceived quality; JPG is nearly half the size.
**Decision:** Use `matt-beach-jpg-smaller.jpg` in `src/templates/home.html`. The PNG is left in place for now but is not referenced by any template.
**Consequences:** PNG still ships to dist as a dead asset. Should be deleted (or the copy step scoped) in a future cleanup. If webp conversion is added (via `<picture srcset>`) the JPG becomes the fallback source.

## 2026-04-10 — Container query for about section, media query for hero mobile padding
**Context:** The about section is a self-contained component (photo + text) whose breakpoint should depend on its own available width, not the viewport. The hero padding tweak is a page-level spacing adjustment with no component boundary.
**Decision:** Container query (`container-type: inline-size` on `.about`, `@container` for the wide layout) for the about section. Regular `@media` for the hero `padding-block-start` reduction on mobile.
**Consequences:** Consistent with CLAUDE.md rule: container queries for component-scoped responsive, media queries for page-level layout. The about section could be dropped into a narrower column layout and the breakpoint would still trigger correctly.

## 2026-04-10 — Stacked about section (no side-by-side grid)
**Context:** The about section had a dead `@container` block that was supposed to produce a 40/60 side-by-side layout (photo left, bio text right) on wide viewports. The block never fired because the element queried itself. Fixing the container query properly would require a parent wrapper; the alternative was to drop the side-by-side ambition.
**Decision:** Remove the container query, `container-type`, and `container-name` entirely. The about section is always stacked (photo above, bio below). Bio text width is unconstrained (no `max-inline-size`) so it aligns to the photo's left edge.
**Consequences:** The profile photo is 1280×720 landscape — placing it in a 40% column beside text would display it at reduced size and wrecked proportions. Stacked layout preserves the landscape presentation. If a side-by-side layout is ever wanted, a parent `.about-wrapper` container would be needed so `.about` can query it as an ancestor.

## 2026-04-10 — Two hero lead sentences as two `<p>` elements, not widened single paragraph
**Context:** The hero lead was a single `<p>` with two sentences. Options: (1) keep single `<p>`; (2) split into two `<p class="hero__lead">` with tighter inner gap; (3) widen the 50ch cap to 72ch. Matt preferred the two-sentence rhythm but not widening the hero footprint.
**Decision:** Split into two `<p class="hero__lead">` elements. Added `.hero__lead:has(+ .hero__lead) { margin-block-end: var(--space-sm); }` in `src/styles/layout.css` to produce a tight inter-sentence gap while preserving the `xl` gap before `.hero__actions`. 50ch cap unchanged.
**Consequences:** The `:has()` selector is the only new CSS. The tight gap is structural (first lead before second lead) rather than a hard-coded `.hero__lead--intro` class. If a third sentence is ever added, a second `<p class="hero__lead">` inherits the treatment automatically.

## 2026-04-10 — CSS Grid (`1fr auto 1fr`) for header nav centering at desktop
**Context:** Header has three direct children with unequal widths: logo, nav links, controls (theme toggle + hamburger). `justify-content: space-between` was the prior flex layout. The nav links appeared visually off-center because logo and controls have different widths.
**Decision:** At `@media (min-width: 48rem)`, switch `.site-header .container` to `display: grid; grid-template-columns: 1fr auto 1fr`. Apply `justify-self: start` to `.nav__logo` and `justify-self: end` to `.nav__controls`. Mobile layout (flex + hamburger) is unchanged.
**Consequences:** True center alignment regardless of flanking widths. Grid is scoped to the desktop breakpoint so it does not affect mobile dropdown behavior. `align-items: center` from the flex base rule carries into the grid context — no duplication needed.

## 2026-04-10 — Data-driven `SOCIAL_LINKS` array over hard-coded footer HTML
**Context:** Matt wanted a "flag like projects" mechanism to add/remove social links without editing HTML. Prior implementation had hard-coded `<li>` elements in `src/templates/base.html`.
**Decision:** Introduced `SocialLink` type, `SOCIAL_LINKS` array with `{ label, href, enabled }`, and `SOCIAL_LINKS_HTML` builder in `build/pages.ts`. `BASE_SLOTS` spread into every `generatePage` call so the `{{social_links}}` slot is available on all pages without per-page wiring. X is in the array with `enabled: false`; flipping one boolean re-enables it.
**Consequences:** Adding a new social link is a one-line array append in `build/pages.ts`. Removing one is a boolean toggle. The footer template is now entirely driven by the array — hand-editing `base.html` to add links is wrong and will be overwritten. Any new page type added via `generatePage` automatically gets the footer links with no additional change.

## 2026-04-10 — `empty-state` paragraph inside existing `.grid-auto` wrapper, not outside it
**Context:** When no projects exist, the projects slot needed a fallback message. Two structural options: (a) render the `<p>` inside the `.grid-auto` wrapper and span it with `grid-column: 1 / -1`, or (b) restructure the template to move the grid wrapper inside the slot so the fallback is a sibling, not a child.
**Decision:** Option (a): `EMPTY_PROJECTS_HTML` renders inside the existing wrapper; `.empty-state { grid-column: 1 / -1 }` handles layout with one CSS property.
**Consequences:** No template restructuring required. The `.empty-state` rule is unconditionally in `components.css`; the lint step will catch it if the HTML producer ever stops emitting the class. Future non-project grid fallbacks can reuse the same class.

## 2026-04-10 — `draft` filter reuses existing production-only mechanism from articles
**Context:** Projects needed a `draft` flag matching the article behavior: visible in `npm run dev`, filtered out in production builds.
**Decision:** Added `draft?: boolean` to `ProjectMeta` and `parseProjectMeta`. Reused the existing production-only filter at `build/markdown.ts:165-170` that already handled articles generically — no new filter logic written.
**Consequences:** Draft projects are still processed and rendered in dev mode, so Matt can keep editing placeholder content. Production builds suppress them. When Matt flips `draft: false` on `mcp-snowflake.md` (or deletes the line), the project appears in production automatically — no build changes needed.

## 2026-04-10 — Swap repo on existing Netlify site rather than create a new site
**Context:** Local repo was linked to a new GitHub remote (`mattnoth/mattnoth-dev`). Options: create a fresh Netlify site pointing at the new repo, or re-link the existing Netlify site.
**Decision:** Re-linked the existing Netlify site via the "Link to a different repository" UI flow. Did not create a new site.
**Consequences:** Site ID, custom domain, env vars, and deploy history all preserved. Any future tooling that references the Netlify site ID (API calls, CLI deploys, webhooks) continues to work without reconfiguration. Creating a new site would have required re-binding the custom domain and recreating any env vars.

## 2026-04-10 — Keep beach photo; hero redesign tabled
**Context:** Matt was evaluating a new blazer portrait to replace the casual beach photo in the hero section. The alternative layout (portrait in right-hand hero column, about blurb pulled up) was prototyped but not landed.
**Decision:** Keep `matt-beach-jpg-smaller.jpg`. The formal headshot lives on LinkedIn; the site can stay casual. Revisit only if Matt gets enough non-professional feedback about the photo.
**Consequences:** The hero redesign work did not land — no branch was cut. If the redesign is revisited, the layout changes needed are: move photo into the hero right column, remove the standalone about section, and pull bio text into the hero. The blazer portrait files were cleaned from `src/assets/images/` by Matt during the session.

## 2026-04-10 — Site voice described by what it is not, not by personality adjectives
**Context:** Memory files had "different kinda guy" and similar personality-claim phrasing. Matt flagged both the original phrase and the first proposed replacement ("person with character") as overclaiming.
**Decision:** Describe the site by what it is not: not Medium, not LinkedIn, not corporate, not ghost-written. No personality adjectives.
**Consequences:** Any future memory or brief that attempts to describe the site's "vibe" should use the negative-definition framing. This applies to memory files and any briefs written to specialists — do not reach for adjectives to fill the void.

## 2026-04-10 — `netlify.toml` as sole source of truth for publish dir and Node version
**Context:** During the Netlify repo swap, the UI publish-directory field showed `public/` while `netlify.toml` had `publish = "dist"`. Netlify also offers a UI field for Node version.
**Decision:** Correct the UI publish-directory to `dist` to match `netlify.toml`, and rely on `netlify.toml` (`NODE_VERSION=22` is already pinned there) rather than setting a UI env var.
**Consequences:** `netlify.toml` is the authority. UI fields are kept in sync to avoid confusion but are not load-bearing. Any future build config changes (Node upgrade, publish dir change) must go into `netlify.toml` first; updating the UI is secondary cosmetic hygiene.

## 2026-04-12 — Draft filter applied at list-render level in `build/pages.ts`, not at parse level
**Context:** `build/markdown.ts` has an `isProd` gate that was intended to strip drafts from production builds. The gate never fires because `npm run build` does not set `NODE_ENV=production`. The draft MCP project was leaking onto `/projects/` in all environments.
**Decision:** Added a draft filter directly inside the projects list render in `build/pages.ts`. Drafts are excluded unconditionally (dev and prod), matching the home-page behavior. Individual draft pages still generate so Matt can preview them via direct URL in dev.
**Consequences:** `npm run dev` and `npm run build` now show the same empty projects state — no environment divergence. The `isProd` filter in `build/markdown.ts` remains in place but is dead code until `NODE_ENV` is wired through `package.json`. This was a deliberate deferral: wiring `NODE_ENV` touches the build script and opens a broader question about what else might key off it.

## 2026-04-12 — Footer restructured as centered vertical stack, removing flex-row layout
**Context:** Footer had a `flex-wrap` / `justify-content: space-between` layout that produced an uneven "jumble" at narrow viewports. The footer contains three elements (social nav, email line, copyright) that had no clean natural reading order in the wrapping layout.
**Decision:** Changed footer to `flex-direction: column; align-items: center; text-align: center` at all viewports. DOM order is `social nav → email → copyright` top to bottom. Removed `flex-wrap` and `justify-content: space-between` entirely.
**Consequences:** Footer is always a vertical stack — no responsive breakpoint needed for the footer itself. Reading order and visual order are aligned, which is cleaner for screen readers. If a horizontal footer layout is wanted in future, the DOM order would need revisiting since `flex-direction: row` would read social → email → copyright left to right, which may not be the preferred order at that point.

## 2026-04-12 — Hero email line removed; no replacement tagline added
**Context:** Hero had "Email me @ matt.j.noth@gmail.com — I'll have Claude hit you back." as a trailing line. Matt wanted it relocated. A three-descriptor tagline ("Software engineer. Context engineer. Keyboard player.") was proposed as a replacement; Matt rejected it after seeing it rendered on the site.
**Decision:** Remove the hero email line. Add it to the footer as a second `<p>` instead. No replacement tagline — hero ends at "an actual human, and can prove it."
**Consequences:** The three-descriptor format is ruled out for the hero — it reads as a LinkedIn tagline in context. The footer email placement works as a sign-off rather than a first impression. If Matt later wants a tagline, it needs a different form; the adjective-list format is explicitly rejected.

## 2026-04-12 — Light mode hard default; OS preference fully removed
**Context:** Matt wanted light mode on first visit regardless of OS `prefers-color-scheme`. The prior behavior respects the OS signal on first visit and falls back to light only when no preference is set.
**Decision:** Removed the `@media (prefers-color-scheme: dark)` block from `src/styles/tokens.css`, deleted `getSystemTheme()` and the `matchMedia` listener from `src/ts/modules/theme-toggle.ts`, and set `data-theme="light"` directly on `<html>` in `src/templates/base.html`. Both CSS and JS sides were cut — not just one.
**Consequences:** First-time visitors always see light mode. `localStorage.theme` still persists the user's manual choice across visits. OS preference is completely ignored. Re-adding OS-respecting behavior requires edits to both `tokens.css` and `theme-toggle.ts` in tandem. The `[data-theme="light"]` CSS block now duplicates `:root` exactly; both must be updated if the light palette changes.

## 2026-04-22 — `[REDACTED]` as markdown syntax for redacted content; lint allowlist for the emitted class
**Context:** Research pages and articles needed a way to mark redacted content so it renders as a styled `<span class="redacted">` in HTML. Two approaches: (a) authors write raw HTML `<span>` tags in markdown source, or (b) authors write a marker token and a build transform handles conversion.
**Decision:** Chose (b). `[REDACTED]` is the marker syntax; `transformRedacted()` in `build/markdown.ts` converts it post-`marked()` via string replacement. `"redacted"` was added to the `JS_APPLIED` allowlist in `build/lint-classes.ts` rather than teaching the linter to trace through build-time transforms. Applied to missing-scientists pages via `postProcess` in `build/missing-scientists.ts`. Also replaced three hardcoded `<span>` tags in `src/content/articles/circle-of-slop.md` with the marker syntax.
**Consequences:** Authors write `[REDACTED]` in markdown — natural, readable in raw form, no ambiguity with link syntax. The lint allowlist entry is the canonical record that this class comes from a transform, not from a dormant infrastructure class. If additional build-time transforms are added in future, the same pattern applies: allowlist entry with a comment naming the transform. A marked extension was rejected as more complex than a one-line string replacement for this single-token case.

## 2026-04-22 — Dev server port changed from 3000 to 3001
**Context:** Concurrent agent sessions were conflicting on port 3000, preventing the dev server from binding.
**Decision:** Changed default dev server port in `build/build.ts` from 3000 to 3001.
**Consequences:** `npm run dev` now binds to port 3001. The zombie-watcher problem (port in use → serve fails but watcher keeps running) still applies if 3001 is also taken. `lsof -i :3001` to find the PID.

## 2026-04-22 — circle-of-slop.md published as-is; "as-is" convention for future articles
**Context:** `circle-of-slop.md` was composed as an email and handed to the site verbatim. It contains intentional typos ("teh top of my head"), punctuation stylizations ("ding..dingdingding.."), and inline `[REDACTED]` gags. Matt's direction: "publishing it as is — the shape of the email, list, and asides formulate the thought itself."
**Decision:** Publish without any editorial cleanup. Establish a convention: if an article's frontmatter description notes "published as-is" (or the commit message says so), future agents must not clean up typos, reformat prose, or polish phrasing. The raw form is the content.
**Consequences:** Typo-correction workflows that apply globally to `src/content/articles/` must be opt-in, not opt-out. A future linter that flags typos would need a per-file suppression mechanism. Agents editing article prose need to explicitly check for an "as-is" indicator before making any changes.

## 2026-04-22 — `.redacted` censor-bar colors hardcoded, not theme tokens
**Context:** The `.redacted` class in `src/styles/components.css` uses `oklch(11% 0.015 260)` for the bar background and `oklch(97% 0.004 80)` as the reveal text color. An alternative was to draw from `--color-bg` or `--color-text` tokens so the bar participates in the light/dark theme swap.
**Decision:** Hardcode both values. A censor bar is a metaphor (opaque ink) that must stay dark-on-dark regardless of palette. Tokenizing the bar color would invert it in dark mode (near-white ink on near-white background) and break the metaphor.
**Consequences:** If the palette is retuned (hue shift, lightness change), the censor bar stays unchanged — intentional. The bar and reveal text are immune to `[data-theme="dark"]` overrides. If a future design wants a theme-aware redaction effect (e.g. a highlight instead of an ink bar), that is a new design decision requiring a new CSS approach, not just token swaps.

## 2026-04-22 — `marked.use()` renderer extension over standalone `Renderer` instance for table wrapping
**Context:** `build/missing-scientists.ts` needed to intercept table rendering to add a scroll wrapper div. A standalone `new marked.Renderer()` with prototype method delegation was the first approach; it failed in marked v15 because the instance lacks parser context.
**Decision:** Use `marked.use({ renderer: { table(token) { … } } })` to override the table renderer. The override is registered once at module load; the method receives the fully-contexted `this` from the live renderer.
**Consequences:** Any future marked renderer customizations in `build/missing-scientists.ts` or `build/markdown.ts` must use the `marked.use()` pattern. The standalone-instance approach should not be reused — it is documented as broken in v15 in the knowledge base.

## 2026-04-22 — `max-inline-size` viewport cap on `.ms-table-wrap` as band-aid for prose overflow
**Context:** Mobile testing showed a double horizontal scroll on missing-scientists pages after table wrapping was added — the table wrapper scrolled inside a prose container that was itself already overflowing the viewport. The prose overflow is a pre-existing bug, not introduced by the table work.
**Decision:** Added `max-inline-size: calc(100vw - 2 * var(--space-md))` to `.ms-table-wrap` to prevent the double-scroll symptom. Did not fix the underlying prose overflow in this session.
**Consequences:** The band-aid hides the symptom without fixing the root cause. The missing-scientists prose layout still overflows on mobile. A dedicated mobile layout fix session is needed. If other scroll-island elements are added to these pages before the layout fix lands, they will need the same cap.

## 2026-04-22 — Mobile TOC overlay via `<details>` + inline light-dismiss script, no TS module
**Context:** Missing-scientists pages needed a collapsible TOC for mobile without breaking the always-visible sidebar on desktop. Options: (a) a new TS module loaded via `[data-module]`, (b) inline `<script>` in the build output, (c) CSS-only via `:target` or `popover`.
**Decision:** Inline `<script>` emitted by `build/missing-scientists.ts`. The script is under 15 lines, handles click-outside and link-click dismissal, and requires no module registry entry or separate file.
**Consequences:** Light-dismiss logic lives in build output, not in a versioned TS file — making it harder to audit in isolation. Acceptable trade-off for a single-use, sub-15-line behavior. If the pattern expands (multiple overlay triggers, animation hooks), migrate to a TS module.

## 2026-04-22 — Grid layout uses `:has(.ms-toc)` to conditionally allocate sidebar column
**Context:** Not all missing-scientists pages have a TOC. On pages without one, allocating a 15rem sidebar column would leave an empty gap.
**Decision:** The grid template for missing-scientists page layout uses `:has(.ms-toc)` to conditionally switch from single-column to sidebar+content layout. Pages without `.ms-toc` get single-column automatically.
**Consequences:** No per-page template flag needed; presence of the `.ms-toc` element is the signal. Any page that conditionally includes the TOC block gets the correct layout without extra build logic.

## 2026-04-22 — Desktop TOC: `<summary>` hidden, `<ol>` forced visible via CSS
**Context:** On desktop, the `<details>` summary trigger should be invisible and the TOC list should always be open. CSS-only approach was preferred over setting `open` attribute in the build output.
**Decision:** At the desktop breakpoint (≥64rem), set `display: none` on the `<summary>` and `display: block` on the `<ol>` inside `<details>`. The `<details>` open/closed state is irrelevant at this breakpoint.
**Consequences:** The forced-open state is entirely CSS-driven — no JS and no `open` attribute required. Closing the `<details>` on mobile and then resizing to desktop does not leave an empty sidebar. If the breakpoint logic ever changes, both the summary hide and the list show rules must move together.

## 2026-04-22 — `.ms-nav__links` never wraps at any width; horizontal scroll strip
**Context:** The section nav on missing-scientists pages had a 40rem breakpoint at which items would wrap. At intermediate widths (~1111px) the 9 items could not wrap cleanly at any size — they always produced a janky intermediate state.
**Decision:** Remove the wrapping breakpoint entirely. Set `inline-size: max-content; overflow-x: auto` and hide the scrollbar. Nav items never wrap; the strip scrolls horizontally when it overflows.
**Consequences:** On very narrow viewports the nav requires a horizontal swipe to reach later items. This is acceptable given the section structure. The scrollbar is hidden but the strip is still scrollable — any future touch-target work should verify swipe reachability on real devices.

## 2026-04-22 — `landing` field on `ProjectMeta` for externally-generated project pages
**Context:** The Missing Scientists dossier is generated by `build/missing-scientists.ts` into its own directory structure, not rendered via the standard `project.html` template. The project card still needed to appear on the home page and projects index with the correct link.
**Decision:** Added `landing?: string` to `ProjectMeta`. When present, `projectCard()` uses that value as the card href and the build loop skips generating a standalone `project.html` for that entry. `missing-scientists.md` is a frontmatter-only file with `landing: /projects/missing-scientists/`.
**Consequences:** Generalizes to any future project whose page is generated outside the standard template pipeline (submodule outputs, external tools, hand-authored pages). Adding a new landing-based project requires only a frontmatter-only `.md` file with the `landing` field — no changes to build logic. The `project.html` skip is silent; the build does not warn when a project is skipped.

## 2026-04-22 — AI disclosure on Transparency page, not a new "about this project" page
**Context:** The Missing Scientists dossier needed an AI-disclosure / methodology note visible to readers. Options: (a) a new tab or page within the dossier nav, (b) adding the disclosure to the existing Transparency page.
**Decision:** Added the disclosure as a section at the top of the Transparency page in `build/missing-scientists.ts`. Written in neutral descriptive voice (not first-person) so Matt can edit later.
**Consequences:** Keeps the disclosure inside the existing dossier nav without adding a new nav item or page. The Transparency page is now a composite of methodology + technical transparency — two related but distinct concerns. If either section grows significantly, splitting it into two pages becomes worthwhile.

## 2026-04-22 — 301 redirect in `netlify.toml` for old `/unpublished/` URLs
**Context:** The dossier URL moved from `/unpublished/missing-scientists/` to `/projects/missing-scientists/`. Any external links or cached URLs pointing at the old path would 404 without a redirect.
**Decision:** Added a `[[redirects]]` block in `netlify.toml`: `from = "/unpublished/missing-scientists/*"`, `to = "/projects/missing-scientists/:splat"`, `status = 301`.
**Consequences:** Old URLs are permanently forwarded. The `research-missing-scientists` submodule and its data files are unaffected — only output paths changed. If the dossier URL changes again, the redirect chain must be extended or collapsed.

## 2026-04-23 — Redacted reveal as click-triggered animation, not CSS focus state
**Context:** The `.redacted` censor bar had a CSS-only reveal tied to `:focus-visible`/`:focus-within`. The behavior was broken: focus state persisted after keyboard navigation, leaving the text visible indefinitely. Options: (a) keep CSS-only with a different selector, (b) JS click handler adding a class that triggers a CSS animation.
**Decision:** JS click handler in `src/ts/main.ts` using document-level event delegation. Click adds `redacted--peeking` class which triggers a 600ms CSS animation (peek, hold, return). Class is not removed by JS — the animation drives the visual lifecycle. `tabindex="0"` removed from redacted spans since keyboard focus is no longer part of the reveal mechanism.
**Consequences:** Reveal is transient and click-only. Screen readers that never click will not trigger the peek. Redacted spans are no longer focusable, which removes any keyboard path to the content — this is consistent with the censorship metaphor. Event delegation was chosen over per-element listeners because redacted spans are scattered in prose with no single wrapper mount point.

## 2026-04-23 — Fixed ink colors on censor bar rather than theme tokens
**Context:** A prior commit (`cb826ad`) changed the `.redacted` bar from fixed `oklch` values to `var(--color-text)` and `var(--color-bg)` so the bar would "participate in theming". In dark mode, `--color-bg` is near-black, so the bar became near-black-on-near-black — invisible. The comment in the code still said "fixed ink" but the code contradicted it.
**Decision:** Reverted to fixed `oklch(11% 0.015 260)` for the bar and `oklch(97% 0.004 80)` for revealed text. Both values are hardcoded and do not reference theme tokens.
**Consequences:** Censor bar is always dark ink regardless of theme. The dark-mode override block in `[data-theme="dark"]` does not affect it. See also the 2026-04-22 decision on this same topic — this commit is the correction of a regression introduced after that decision was made.

## 2026-04-12 — About paragraph 2 uses two-sentence structure (thesis + gerund expansion), not em-dash list
**Context:** About paragraph 2 needed to describe Matt's current AI infrastructure work without burning Harness brief vocabulary. Two structural options debated: (a) "AI infrastructure for coding agents — engineering context, MCP servers, multi-agent workflows" (em-dash list), (b) "Lately I've been building AI infrastructure for coding agents. Designing multi-agent workflows, building custom MCP servers to interface with our stack, and engineering the context layer that ties them together." (two sentences).
**Decision:** Option (b): thesis sentence + gerund-fragment expansion. Matt made a post-edit cut dropping "That's meant" from the start of sentence 2, making it a gerund fragment.
**Consequences:** The em-dash list format reads as definitional (X = these things), which overcommits the category. Two sentences signal "here is what I've been doing under that umbrella" with room for the category to be broader. Gerund fragment is intentional stylistic choice, not a draft artifact. The Harness brief vocabulary ("structured domain knowledge, routing, trust-ranked context") is reserved for the brief itself.

