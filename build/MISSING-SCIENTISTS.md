# Missing Scientists Section

Website section rendering the research dossier on deaths and disappearances of U.S. defense and advanced-research scientists at `/projects/missing-scientists/`.

## How it consumes the research repo

`build/missing-scientists.ts` reads markdown and JSON from the sibling research repo at `../research-missing-scientists/` (override with `MS_RESEARCH_DIR` env var).

At build time it reads all markdown files, converts to HTML via `marked`, post-processes source-tier badges and confidence ratings, generates static pages via the template system, and copies diagram/timeline JSON for D3 to fetch at runtime.

## Rebuild after research updates

```bash
npm run build
```

The build reads the research repo fresh on every run.

## Pages generated

- Landing, 11 case pages, 3 analysis pages, diagram, timeline, methodology, sources, transparency (20 pages total)

## Dependencies added

- `d3` v7.9.0, `@types/d3` v7.4.3 (interactive visualizations)

## Key files

- `build/missing-scientists.ts` — page generator
- `src/templates/ms-page.html`, `ms-diagram.html`, `ms-timeline.html` — templates
- `src/styles/missing-scientists.css` — scoped CSS
- `src/ts/modules/ms-diagram.ts`, `ms-timeline.ts` — D3 modules
