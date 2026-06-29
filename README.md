# dossier-site

Standalone website for **The Missing Scientists** — a structured, evidence-based
research dossier on deaths and disappearances of U.S. defense and advanced-research
scientists. Zero framework runtime: static HTML, native CSS, and vanilla TypeScript,
built with a custom esbuild pipeline and deployed to Netlify.

This is **one self-contained repo** holding both:

- the **website build** (`build/`, `src/`) — the generator, markdown rendering,
  templates, CSS skin, and the two D3 visualizations (connection diagram + timeline);
- the **research content + maintenance harness** (`research/`) — the dossier itself
  (`research/dossier.md`, `research/cases/`, `research/analysis/`, …) and the
  Claude-Code research pipeline that maintains it.

The site was forked from a personal-site engine and re-skinned; the dossier styling is
inherited intact, with only an X-Files "case file" skin layered over the design tokens.

## Develop

```sh
npm install
npm run dev        # build + watch + serve on http://localhost:3001
npm run build      # typecheck + production build into dist/
npm run typecheck
```

`npm run build` reads the markdown under `research/`, renders the dossier into root-relative
pages, copies the D3 data JSON, generates the sitemap/robots/OG image, and writes everything
to `dist/`. Netlify publishes `dist/` (see `netlify.toml`).

## Configuration

All branding, origin, and routing live in [`build/site.config.ts`](build/site.config.ts):

- `SITE_ORIGIN` — canonical origin for canonical/OG/sitemap. Override at build time:
  `SITE_ORIGIN=https://example.com npm run build`. Default is the Netlify placeholder.
- `BASE` — base path; `""` (site is rooted at `/`).
- `siteName`, `tagline`, `author`, `social[]`, `footerNote`, `accent`, `ROBOTS`, `OG_IMAGE_PATH`.

The generator resolves research content from `./research` by default; override with
`MS_RESEARCH_DIR=/path/to/research`.

## Editing the dossier

Edit markdown under `research/` and re-run `npm run build`. The research maintenance
workflow is documented in [`research/CLAUDE.md`](research/CLAUDE.md) and
[`research/RUNBOOK.md`](research/RUNBOOK.md).

> All prose in the dossier is AI-generated under human direction from public sources.
> Investigation does not imply endorsement of any hypothesis.
