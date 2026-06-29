# dossier-site — Claude Code project guide

## What this is

The standalone website for **The Missing Scientists** research dossier. One
self-contained repo holding both the **website build** and the **research content +
maintenance harness**. Zero framework runtime: static HTML, native modern CSS, and
vanilla TypeScript, built with a custom esbuild-driven pipeline and deployed to Netlify.

It was forked from a personal-site engine: the build engine and dossier styling are
**inherited intact**, with an X-Files "case file" skin layered only over the design
tokens (`src/styles/tokens.css`) and nav (`src/styles/nav.css`).

## Layout

| Path | Role |
|------|------|
| `build/` | Generator + markdown rendering. `build.ts` orchestrates; `missing-scientists.ts` renders the dossier; `site.config.ts` holds all branding/origin/routing. |
| `src/templates/` | `base.html` (shell) + `ms-*.html` (dossier page/diagram/timeline). |
| `src/styles/` | Design tokens + the inherited dossier CSS (`missing-scientists.css`). |
| `src/ts/` | Vanilla TS modules incl. the two D3 visualizations (`ms-diagram`, `ms-timeline`). |
| `research/` | The dossier content (`dossier.md`, `cases/`, `analysis/`, `appendices/`, `data/`, `logs/`) **and** the research maintenance harness. See [`research/CLAUDE.md`](research/CLAUDE.md). |

## Build

```sh
npm install
npm run dev        # watch + serve on :3001
npm run build      # tsc typecheck (x2 configs) + tsx build/build.ts → dist/
npm run typecheck
```

Pipeline (`build/build.ts`): clean → render dossier pages → lint-classes → sitemap/robots
→ CSS concat → esbuild JS → copy assets → generate images.

## Stack (locked in — do not propose alternatives)

TypeScript 5.8+ · native CSS (no Sass/PostCSS/CSS-in-JS) · markdown+frontmatter
(gray-matter, marked) · esbuild · `tsc --noEmit` · custom TS build via `tsx` · D3 for the
two visualizations.

## Rules / gotchas

- **Config-first.** Branding, `SITE_ORIGIN`, `BASE`, social links, robots policy all live
  in `build/site.config.ts`. Don't hardcode them in the generator or templates.
- **Site is rooted at `/`** (`BASE === ""`). Internal links and output paths are
  root-relative. The D3 modules navigate from the root and read their data via the
  `data-src` attribute on `.ms-interactive`.
- **Styling is inherited, not re-architected.** Only `tokens.css` / `nav.css` carry the
  skin. Don't rewrite `missing-scientists.css`.
- **lint-classes** fails the build on classes used in HTML with no CSS rule. (Inherited
  CSS that no dossier template uses is a non-fatal warning.)
- **Research content** resolves from `./research` (override `MS_RESEARCH_DIR`). The
  research repo's own rules (no-contact policy, source tiering, neutrality) are in
  `research/CLAUDE.md` and apply when editing anything under `research/`.
- All dossier prose is **AI-generated under human direction from public sources**; the
  AI-disclosure banner and Transparency page must stay.
