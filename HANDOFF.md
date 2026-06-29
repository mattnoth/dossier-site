# Handoff & Progress Audit — dossier-site

**Date:** 2026-06-29
**Prepared for:** advisory-board / audit review
**Author:** Claude Code (under human direction)
**Status:** Build complete and locally verified. **Not deployed. Not committed.** Awaiting review.

---

## 1. Objective

Fork the personal site `mattnoth-dev` into **one self-contained repo** (`dossier-site`)
that renders the *Missing Scientists* research dossier as its own standalone website —
without taking the existing page on `mattnoth.com` down. Copy the research content +
maintenance harness in, drop the git submodule, strip the personal pages, de-personalize
behind a config, apply an "X-Files / case-file" skin, build, and verify locally.

Scope for this run: build-doc Steps 1–7 + the local Verification checklist.
**Out of scope (deliberately deferred):** Netlify deploy, final domain, and the one-line
relink of `mattnoth.com`'s project box (Step 8).

## 2. Three-repo map (state after this run)

| Repo | Role | State |
|------|------|-------|
| `mattnoth-dev` | Source of build engine; still renders the dossier at `/projects/missing-scientists/` | **Untouched — 0 changed files** (verified via `git status`). Live site unaffected. |
| `research-missing-scientists` | Source of dossier content + harness (was the submodule) | Read-only source; copied from. |
| **`dossier-site`** | **NEW** standalone site (this deliverable) | Built + verified locally; uncommitted working tree. |

## 3. What was delivered

- **New repo** created from `mattnoth-dev`'s working tree (no `.git`/`node_modules`/`dist`/
  submodule), fresh `git init`, `.gitmodules` removed. Research content inlined into
  `research/`. No submodule remains.
- **Config layer** — `build/site.config.ts` centralizes `SITE_ORIGIN` (env-overridable),
  `BASE` (`""`, site rooted at `/`), `siteName`, `tagline`, `author`, `social[]`,
  `footerNote`, `accent`, `ROBOTS`, `OG_IMAGE_PATH`.
- **Re-rooted** all output paths and internal links to root-relative; fixed the D3
  `data-src` attributes and the modules' link-base constants.
- **De-personalized** — every "Matt Noth" / `mattnoth.dev` / old-subpath string in page
  chrome now flows from config; OG/icon image branding rebranded to the dossier.
- **Stripped** the personal site — deleted `build/pages.ts`, the home/about/article/
  project templates, and `src/content/`. Trimmed `build.ts`; rewrote `sitemap.ts` to scan
  `dist/` and emit `sitemap.xml` **+ `robots.txt`** from `SITE_ORIGIN`.
- **Standalone shell** — rewrote `base.html` with dossier nav, config-driven title/footer,
  and a persistent **AI-disclosure banner**; preserved theme-toggle + scroll-reveal hooks.
- **X-Files skin** — re-skinned `tokens.css` (dark terminal-green default + manila-folder
  light mode, monospace headings, squared corners) and `nav.css` (banner + subtle
  scanline). Styling is layered over the inherited CSS, not re-architected.
- **Repo docs** — replaced the personal-site `README.md`/`CLAUDE.md` with dossier versions;
  dropped a stale `.claude/settings.local.json` and gitignored it.

## 4. Verification evidence

| Check | Result |
|------|--------|
| `npm run typecheck` | ✅ clean (both tsconfigs) |
| `npm run build` | ✅ succeeds (~447ms) |
| `dist/` structure | ✅ root `index.html`, all 11 `cases/*`, 3 `analysis/*`, `diagram/`, `timeline/`, `sources/`, `methodology/`, `transparency/`, `data/*.json` |
| Routes served (HTTP) | ✅ all key routes return `200` |
| **D3 connection diagram** | ✅ renders — 45 nodes / 52 edges, no console errors |
| **D3 timeline** | ✅ renders — 48 events / 199 labels, no console errors |
| Leak grep over `dist/` — `Matt Noth` | ✅ **0** |
| Leak grep over `dist/` — `/projects/missing-scientists` | ✅ **0** |
| `SITE_ORIGIN` env override | ✅ canonical + sitemap reflect override (trailing slash stripped) |
| `MS_RESEARCH_DIR` override | ✅ preserved (default `./research`) |
| `mattnoth-dev` untouched | ✅ 0 changed files |

Runtime render was confirmed by serving `dist/` and inspecting the live SVG/DOM, not just
by reading source.

## 5. Decisions & rationale

1. **D3 module `BASE` constants set to `''`** (beyond the build doc's `data-src` note).
   `ms-diagram.ts` / `ms-timeline.ts` hardcoded the old subpath for case-link navigation;
   left as-is it would break links *and* leak the old path into `main.js`. Now zero
   old-base references in the bundle.
2. **lint-classes: `unusedInCss` downgraded to a warning** (kept `missingInCss` fatal).
   Removing the personal templates orphaned ~23 inherited CSS classes; the build doc says
   keep the CSS intact / don't re-architect, so failing on inherited-but-unused CSS would
   be wrong. The valuable half of the contract (every HTML class must have a rule) stays
   enforced.
3. **`ROBOTS` defaults to `index, follow`** (was `noindex` as a hidden subsection). This is
   a public standalone launch. **Board decision point** — flip in `site.config.ts` if the
   site should stay unindexed until the domain is final.
4. **Repo left uncommitted.** An audit-before-commit posture; no commit was requested.

## 6. Risk register / open items

| Item | Severity | Note |
|------|----------|------|
| Final domain not set | Low | Builds on Netlify placeholder; `SITE_ORIGIN` env + config make it a one-line change. |
| Indexing policy (`ROBOTS`) | Low | Default now indexable — confirm that's intended pre-launch. |
| `mattnoth.dev` appears once in `dist/transparency/` | Info | Inside the embedded research log (accurate project history), inherited behavior — not site chrome. |
| Inherited `docs/` + `.claude/` (personal-site dev harness/agents) | Low | Harmless but unrelated to the research harness in `research/`; optional cleanup. |
| `build/MISSING-SCIENTISTS.md` internal note | Trivial | One old-path mention in prose; not built into `dist/`. |
| Security: 2 npm advisories (1 low, 1 moderate) | Low | From `npm install`; review before deploy. |

## 7. Next steps (Step 8 — requires sign-off)

1. Decide final domain + indexing policy.
2. Create a Netlify site from `dossier-site` (inherited `netlify.toml` is ready); ship on
   the `*.netlify.app` URL first.
3. Set the domain in Netlify + `SITE_ORIGIN`; verify canonical/OG.
4. **Only then** touch `mattnoth-dev`: change the project-box `landing:` to the new URL
   (its submodule pin / pinned build stay frozen). Commit + push `mattnoth-dev`.
5. Commit `dossier-site` (the inherited end-session skill would do this, but it auto-runs
   the personal-site `progress-tracker` + `docs/` flow — retune or bypass it for this repo).

---

*All dossier prose is AI-generated under human direction from public sources. Investigation
does not imply endorsement of any hypothesis.*
