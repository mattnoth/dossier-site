# Phase 2 — Build System

**Owner subagent:** `build-specialist`

---

## Task: Implement the complete build system

Build the full pipeline in the `build/` directory. All build scripts run via `tsx` (already in dev dependencies). Use modern TS throughout — satisfies, import type, as const, no enums.

### build/markdown.ts
- Parse frontmatter from .md files using gray-matter
- Convert markdown body to HTML using marked
- Define and export types:
  - ArticleMeta: { title: string, slug: string, date: string, tags: string[], description: string, draft?: boolean }
  - ProjectMeta: { title: string, slug: string, description: string, tech: string[], url?: string, github?: string, featured?: boolean }
  - ParsedContent<T>: { meta: T, html: string, readingTime: number }
- Export function: parseContentDir<T>(dir: string): Promise<ParsedContent<T>[]>
- Calculate reading time: Math.ceil(wordCount / 200)
- Filter out draft: true articles in production builds
- Sort articles by date descending

### build/templates.ts
- Simple slot-based template engine using string replacement
- Read HTML template files from src/templates/
- Replace {{slot_name}} placeholders with provided content
- Support template composition: article.html content gets inserted into base.html's {{content}} slot
- Template slots include: {{title}}, {{content}}, {{meta}}, {{date}}, {{tags}}, {{reading_time}}, {{description}}, {{recent_articles}}, {{featured_projects}}, {{articles}}, {{projects}}
- Export function: renderTemplate(templateName: string, slots: Record<string, string>): Promise<string>
- Export function: renderPage(templateName: string, slots: Record<string, string>): Promise<string> — wraps content in base.html

### build/pages.ts
- Generate all static HTML pages:
  - Home page: inject recent 3 articles + featured projects
  - Articles list: all articles sorted by date desc
  - Individual article pages from parsed markdown
  - Projects list: all projects
  - Individual project pages from parsed markdown
- Clean URL structure: write to dist/articles/my-post/index.html
- Generate article cards as HTML strings for list pages
- Generate project cards as HTML strings for list/home pages
- Export function: generateAllPages(articles, projects): Promise<void>

### build/copy-assets.ts
- Recursively copy src/assets/ → dist/assets/
- Copy any root static files (favicon.ico, robots.txt) → dist/

### build/build.ts — main orchestrator
- Steps in order:
  1. Clean dist/ directory
  2. Parse all markdown content from src/content/
  3. Generate all HTML pages via templates
  4. Concatenate CSS files in @layer order → dist/main.css
  5. Bundle TS via esbuild → dist/main.js (bundle, minify, sourcemap, target es2022, format esm)
  6. Copy static assets
- Accept --dev flag: skip minification, enable sourcemaps, add watch mode
- Log timing for each step: "[build] CSS: 12ms"
- Handle errors gracefully — log clear messages, exit with code 1

### Dev server
- Use esbuild's context API with serve() for the dev server
- Watch src/ for .ts, .css, .html, .md changes
- On change: rebuild affected steps (CSS change = rebuild CSS only, md change = rebuild pages)
- Serve dist/ on localhost:3000
- Log rebuild times

### Important
- All file I/O uses Node fs/promises
- All paths use Node path module for cross-platform compatibility
- Build scripts import from each other cleanly — no circular deps
