# Missing Scientists — Styling Fixes (2026-04-21)

Continuation prompt for fixing mobile and desktop styling regressions in the missing-scientists research section. All styling lives in `mattnoth-dev` (the submodule is pure markdown + JSON — zero CSS). The pipeline is:

- **Content:** `research-missing-scientists/*.md` → `build/missing-scientists.ts` → HTML
- **Templates:** `src/templates/ms-page.html`, `ms-timeline.html`, `ms-diagram.html`
- **CSS:** `src/styles/missing-scientists.css` (848 lines, all `.ms-*` prefixed, `@layer components`)
- **Table styles:** `src/styles/typography.css` (lines 187–231, inside `.prose`)
- **Timeline TS:** `src/ts/modules/ms-timeline.ts` (644 lines, D3 SVG renderer)

---

## Current issues (reported by Matt)

1. **Mobile layout breaks once dossier content starts.** The initial page (nav, header) sizes correctly on mobile, then the content area blows out wider than the viewport once the dossier prose/tables begin.

2. **Timeline is broken on both mobile AND desktop.** The mobile-responsive pass (commit `42d3ea7`) regressed the desktop timeline — the previous desktop layout (commit `781c868`) was significantly better. Both need attention.

3. **Tables are too wide and force the prose container to expand.** The `.ms-prose` width appears to match the table width rather than constraining it. Several case files and analysis pages have multi-column markdown tables (4+ columns with long content — see `analysis/connection-analysis.md`, `cases/reza.md`) that blow out the layout.

---

## Root cause analysis

### Mobile prose blowout

The template structure is: `.container.ms-section > .ms-article > .ms-layout > .prose.ms-prose > {{content}}`.

- `.container` constrains via `max-inline-size: var(--container-max)` (75rem) + `padding-inline: clamp(1rem, 5vw, 3rem)`.
- `.ms-prose` sets `max-inline-size: 75ch` — but this is a **max**, not a **min-cap**. The real problem is downstream.
- `.prose table` in `typography.css` uses `display: block; inline-size: max-content; max-inline-size: 100%;`. The `max-content` intrinsic size can exceed the viewport, and `max-inline-size: 100%` should cap it — but `100%` resolves against the `.ms-prose` parent, which itself may not be properly constrained in the grid context.
- `.ms-layout` is a grid with `grid-template-columns: 1fr` on mobile. A `1fr` column won't shrink below `min-content` by default, and a `max-content` table IS the min-content of `.ms-prose`. **Fix: add `min-inline-size: 0` to `.ms-prose` (or `minmax(0, 1fr)` to the grid column) so the table's `max-inline-size: 100%` actually resolves against the available space rather than the intrinsic content width.**
- The `body` grid already has `grid-template-columns: minmax(0, 1fr)` (layout.css line 9), so the top-level container is correct. The gap is in `.ms-layout`'s `1fr` column and `.ms-prose` not having `min-inline-size: 0`.

### Timeline regression

Commit `42d3ea7` refactored `render()` to dispatch between `renderDesktop()` and `renderMobile()` based on `canvas.clientWidth < 600`. Key issues:

- **Desktop:** The refactored `renderDesktop()` is functionally equivalent to the old `render()`, but the commit also changed overflow styles (now `overflowY: 'auto'`, `overflowX: 'hidden'`, `maxBlockSize: '80vh'`). These may have altered the desktop experience vs the original.
- **Mobile:** `renderMobile()` uses `containerWidth` for SVG width, single-column cards with `cardWidth = containerWidth - cardX - 12`. Year pill positioning uses a complex offset calculation (`pillY = markerY - cardHeight - MOBILE_CARD_GAP - YEAR_LABEL_HEIGHT + 8`) that may misalign.
- **Both:** The 600px breakpoint is detected via `canvas.clientWidth`, not a CSS media query. If the canvas hasn't been laid out when `mount()` fires, `clientWidth` could be 0 or wrong, causing the wrong renderer to run.

### Wide tables need a different display strategy

The current approach (`display: block` + `overflow-x: auto`) should work for scrollable tables, but the interaction with `.ms-prose { max-inline-size: 75ch }` creates a conflict: the table wants to be wider than 75ch, the prose container says "cap at 75ch", but the grid column expands to fit the table's intrinsic size anyway because of the missing `min-inline-size: 0`.

For pages with genuinely large tables (connection-analysis, foreign-intel-layer, individual case dossiers with 4-column tables), we may want:

- **Option A — Scrollable table island (current intent, needs fix).** Keep `max-inline-size: 75ch` on prose. Add `min-inline-size: 0` so the table's horizontal scroll actually kicks in. Tables scroll horizontally within the 75ch column. Simplest fix.
- **Option B — Full-bleed tables.** Let tables break out of the 75ch prose column into a wider container (negative margins or CSS grid column span). Prose stays 75ch for readability, tables get room to breathe.
- **Option C — Alternate page template for data-heavy pages.** A wider-body template (`ms-page-wide.html`) with no `75ch` cap, designed for pages dominated by tables/diagrams rather than prose. The dossier landing, connection analysis, and foreign intel pages would use this.

Recommendation: **Start with Option A** (it's the bug fix) and evaluate whether Option B or C is needed after seeing the result.

---

## Specific TODO list

### P0 — Layout-breaking bugs

- [ ] **Fix mobile prose blowout.** Add `min-inline-size: 0` to `.ms-prose` in `missing-scientists.css`. This lets `max-inline-size: 100%` on tables resolve against the grid column's available width instead of the intrinsic content width. Verify on: dossier landing, connection-analysis, reza case, hicks case.
- [ ] **Fix `.ms-layout` grid column.** Change `grid-template-columns: 1fr` to `grid-template-columns: minmax(0, 1fr)` so the single-column mobile layout constrains overflowing children. Same change for the desktop `15rem 1fr` → `15rem minmax(0, 1fr)`.
- [ ] **Audit `.ms-article` width.** It has `max-inline-size: 100%` but no `min-inline-size: 0` — verify it's not propagating min-content width upward.

### P1 — Timeline fixes

- [ ] **Restore desktop timeline quality.** Compare `renderDesktop()` at HEAD against the pre-mobile-pass version at `781c868`. Specifically check:
  - Overflow / scroll behavior changes (was there a `maxBlockSize` before?)
  - Card positioning and connector alignment
  - Year pill styling and spacing
  - Overall visual quality — the previous desktop was "much better"
- [ ] **Fix mobile timeline.** Issues to investigate:
  - Year pill vertical positioning formula (`pillY = markerY - cardHeight - MOBILE_CARD_GAP - YEAR_LABEL_HEIGHT + 8`) — does it actually align with events?
  - `canvas.clientWidth` detection — does it fire correctly on initial load? (race with layout)
  - Card text truncation and readability at narrow widths
  - Touch tooltip positioning — does it overflow the viewport?
- [ ] **Consider `ResizeObserver` for timeline breakpoint.** Replace one-shot `clientWidth` check with a resize observer so the timeline re-renders correctly on orientation change and dynamic layout shifts.

### P2 — Table display improvements

- [ ] **Verify horizontal scroll works after P0 fix.** On mobile, wide tables should scroll horizontally inside `.ms-prose` rather than blowing out the layout.
- [ ] **Add scroll hint for wide tables.** On mobile, users may not realize a table scrolls. Consider a subtle gradient fade or "scroll →" indicator on the right edge.
- [ ] **Evaluate full-bleed tables (Option B).** After the P0 fix, check if the 75ch column is too cramped for the 4-column tables in connection-analysis and foreign-intel-layer. If so, implement negative-margin breakout or a grid column span for `table` elements.

### P3 — General mobile polish

- [ ] **Abbreviation tooltip overflow.** `abbr[data-tooltip]::after` uses `white-space: nowrap` — long agency names (e.g., "Defense Advanced Research Projects Agency") will overflow the viewport on mobile. Needs `max-inline-size` + `white-space: normal` at narrow viewports.
- [ ] **TOC on mobile.** Currently the TOC collapses below the prose on mobile (single-column grid). Consider: should it be hidden entirely? Collapsed `<details>` element? Fixed bottom drawer? Current behavior may push content down significantly on long pages.
- [ ] **Nav link wrapping.** `.ms-nav__links` uses `flex-wrap: wrap` — verify it doesn't create an awkwardly tall nav bar on narrow screens with many links.
- [ ] **Test `.ms-prev-next` on mobile.** Prev/next links are in a flex row — verify they don't overlap or truncate on narrow screens.

---

## Files to modify

| File | What changes |
|------|-------------|
| `src/styles/missing-scientists.css` | P0 grid/prose fixes, P3 tooltip/mobile polish |
| `src/styles/typography.css` | P2 table scroll improvements (if needed) |
| `src/ts/modules/ms-timeline.ts` | P1 desktop restoration, mobile fix, resize observer |
| `src/templates/ms-page.html` | Only if Option C (wide template) is adopted |

---

## Testing checklist

Pages to check on mobile (375px) and desktop (1440px) after each fix:

- [ ] Dossier landing: `/unpublished/missing-scientists/`
- [ ] Case with tables: `/unpublished/missing-scientists/cases/reza`
- [ ] Case with tables: `/unpublished/missing-scientists/cases/hicks`
- [ ] Connection analysis (wide table): `/unpublished/missing-scientists/analysis/connections`
- [ ] Foreign intel (wide table): `/unpublished/missing-scientists/analysis/foreign-intelligence`
- [ ] Timeline: `/unpublished/missing-scientists/timeline`
- [ ] Diagram: `/unpublished/missing-scientists/diagram`
- [ ] Non-MS article page (regression check): any article on the main site

---

## Reference commits

- `781c868` — `feat(ms): redesign timeline as vertical card layout` — the good desktop timeline
- `42d3ea7` — `feat(ms): mobile-responsive timeline and custom abbreviation tooltips` — introduced regressions
- `64ef316` — `feat: glossary acronyms now link to institutional websites` — latest on main
