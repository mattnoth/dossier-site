# Phase 6 — Integration, Polish & Deploy

**Owner subagent:** main agent coordinates; `reviewer` heavily used; all specialists as needed for fixes

---

## Task: Wire everything together, verify the build, and polish for deployment

### 1. Verify the full build pipeline
- Run `npm run build` — fix any errors until it completes cleanly
- Confirm dist/ contains:
  - All HTML pages at correct paths (dist/index.html, dist/articles/index.html, dist/articles/building-this-site/index.html, etc.)
  - main.css with all layers concatenated
  - main.js bundled by esbuild with sourcemap
  - assets/ copied
- Run `npm run typecheck` — fix any type errors
- Run `npm run dev` — verify dev server serves pages correctly

### 2. README.md
Write a comprehensive README:
- Project description: what it is, why vanilla TS + CSS
- Tech stack summary
- Getting started: git clone, npm install, npm run dev
- Adding content: how to create a new article or project (create .md, frontmatter format, npm run build)
- Deployment: push to GitHub → Netlify auto-deploys
- Architecture diagram (the file tree)
- Available npm scripts

### 3. Static files
- Create robots.txt allowing all crawlers
- Create a simple favicon placeholder (can be an SVG in a <link> tag in base.html)
- Add sitemap.xml generation to the build step:
  - List all article and project URLs
  - Include lastmod dates from frontmatter
  - Write to dist/sitemap.xml

### 4. Performance checklist — verify all of these:
- [ ] No render-blocking JS (script is type="module", parsed async)
- [ ] CSS loaded with standard <link> (small enough to not need critical CSS extraction)
- [ ] All images have width/height and loading="lazy"
- [ ] Total JS under 10KB gzipped for a typical page
- [ ] Total CSS under 15KB gzipped
- [ ] netlify.toml has appropriate cache headers
- [ ] No unused CSS shipped

### 5. Accessibility checklist:
- [ ] Skip-to-content link present and works
- [ ] All interactive elements keyboard accessible
- [ ] Focus-visible styles on all focusable elements
- [ ] Color contrast meets WCAG AA (check oklch values)
- [ ] Semantic heading hierarchy (h1 → h2 → h3, no skips per page)
- [ ] aria-labels on icon-only buttons (theme toggle, nav toggle)
- [ ] <time> elements with datetime attribute
- [ ] lang attribute on <html>

### 6. Progressive enhancement verification:
- [ ] Site readable with JS disabled (all content is in HTML)
- [ ] Scroll animations degrade: elements visible by default, animation is enhancement
- [ ] Theme defaults to system preference without JS
- [ ] Hamburger nav toggle works via CSS :has() without JS
- [ ] @supports guards on scroll-driven animations

### 7. Final output
- The project should be a complete, deployable static site
- `npm run build` produces a dist/ folder that can be dragged into Netlify for instant deploy
- Every page loads fast, looks polished, and is accessible
- The code is clean, well-organized, and uses modern syntax throughout
