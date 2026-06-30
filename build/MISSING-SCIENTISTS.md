# Dossier generator (multi-dossier publication)

`build/missing-scientists.ts` generates the whole publication: a Tier-1 umbrella
(the dossier directory at `/`, shared Methodology + About pages at the root) plus
each dossier in the `dossiers[]` registry (`build/site.config.ts`) rendered into
its own namespace. The Missing Scientists dossier lives at `/missing-scientists/`.

> The file is still named `missing-scientists.ts` for historical reasons; its
> internals are a generic per-dossier generator (`generateDossier(d)`) that loops
> the registry. Routing, identity, and the Tier-2 section bar are driven by the
> registry; the per-dossier content shape (cases/, analysis/, sources appendices,
> glossary, tier badges) currently assumes the Missing Scientists structure — a
> differently-shaped dossier would need the generator extended.

## How it consumes a research repo

Each registry entry points at a research source dir via `researchPath` (relative
to `build/`), with an optional env override (`researchDirEnv`, e.g.
`MS_RESEARCH_DIR`). The Missing Scientists entry reads from the sibling repo at
`../research`. A dossier whose research repo is absent is skipped (so Netlify CI
builds the chrome without the content).

At build time the generator reads markdown, converts to HTML via `marked`,
post-processes source-tier badges + confidence ratings, rewrites internal `.md`
links to namespaced site URLs, generates static pages via the template system,
and copies each dossier's diagram/timeline JSON to `{base}/data/` for D3 to fetch
at runtime. The shared Methodology + About pages are sourced from `primaryDossier`.

## Rebuild after research updates

```bash
npm run build
```

The build reads the research repo(s) fresh on every run.

## Pages generated

- Umbrella: directory (`/`), `/methodology/`, `/transparency/`
- Per dossier (`/missing-scientists/`): overview, 11 case pages, 3 analysis pages,
  diagram, timeline, sources

## Routing model

- **Tier 1** (shared): brand bar + Methodology + About — served at the site root.
- **Tier 2** (per-dossier): the dossier bar (label + `sections`) rendered into the
  sticky header via base.html's `{{dossier_nav}}` slot; empty on umbrella pages.
- Templates are base-aware via a `{{base}}` slot; the D3 modules read their
  dossier base from `data-base` on the mount element.

## Dependencies added

- `d3` v7.9.0, `@types/d3` v7.4.3 (interactive visualizations)

## Key files

- `build/site.config.ts` — umbrella brand + `dossiers[]` registry
- `build/missing-scientists.ts` — page generator
- `src/templates/base.html`, `umbrella.html`, `ms-page.html`, `ms-diagram.html`, `ms-timeline.html` — templates
- `src/styles/missing-scientists.css`, `nav.css` — scoped + nav CSS
- `src/ts/modules/ms-diagram.ts`, `ms-timeline.ts` — D3 modules (base-aware)
