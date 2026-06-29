# Phase 1 — Project Scaffold & Configuration

**Owner subagent:** `build-specialist`

---

## Task: Initialize project scaffold and configuration

Create the full directory structure at the project root (`/Users/mnoth/source/mattnoth-dev/`).

### 1. package.json
- Name: matthew-noth-dev-site
- Type: "module"
- Engines: `"node": ">=22"` (Node 22 LTS minimum — build scripts use modern APIs)
- Scripts:
  - "dev": runs the dev server (esbuild serve + watch + build)
  - "build": full production build (type check + build)
  - "typecheck": "tsc --noEmit"
  - "clean": removes dist/
- Dev dependencies: typescript (5.8+), esbuild, gray-matter, marked, @types/node (^22), tsx
- No runtime dependencies

### 2. tsconfig.json (browser code)
- Target: ES2024
- Module: ESNext
- ModuleResolution: bundler
- Lib: `["ES2024", "DOM", "DOM.Iterable"]` — ES2024 gives us `Object.groupBy`, `Map.groupBy`, new `Set` methods (`union`, `intersection`, `difference`), and `Promise.withResolvers`
- Strict: true
- verbatimModuleSyntax: true
- erasableSyntaxOnly: true
- noUncheckedIndexedAccess: true (bonus strictness — flags unsafe array/object index access)
- noEmit: true (type checking only — esbuild handles emit)
- Include: ["src/**/*"]

### 3. tsconfig.build.json (build scripts — Node target)
- Extends tsconfig.json
- Override target: ES2024
- Override module: NodeNext
- Override moduleResolution: NodeNext
- Override lib: `["ES2024"]` (no DOM — build scripts are Node-only)
- Types: `["node"]`
- Include: ["build/**/*"]

**Rationale for latest targets:** Build scripts run on your own machine under Node 22+ where all ES2024 features are native. Browser code runs in evergreen Chrome/Safari/Firefox where ES2024 is also fully supported. No downleveling needed for either environment. The "conservative" ethos of this project is about avoiding framework/runtime bloat (no React, no Sass, no CSS-in-JS), *not* about avoiding modern language features.

### 4. netlify.toml
- Build command: npm run build
- Publish directory: dist
- Configure pretty URLs (trailing slash)
- Cache headers: fonts + images = 1 year immutable; CSS/JS = 1 year immutable (filenames will be content-hashed by esbuild)
- Security headers: X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin

### 5. Create all directories and placeholder files
- Every directory from the architecture diagram in CLAUDE.md
- Each file gets a brief comment explaining its purpose
- src/ts/utils/dom.ts should have typed helper stubs:
  - qs<T extends Element>(selector: string, parent?: ParentNode): T | null
  - qsa<T extends Element>(selector: string, parent?: ParentNode): T[]
  - on<K extends keyof HTMLElementEventMap>(el: EventTarget, event: K, handler: (e: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions): () => void
- .gitignore: node_modules, dist, .DS_Store

### Style rules
- No enums — use `as const` objects
- Use `import type` for all type-only imports
- Use `satisfies` where it adds value
- Prefer `const` assertions for config objects

---

## Target directory layout

```
/Users/mnoth/source/mattnoth-dev/
├── src/
│   ├── content/
│   │   ├── articles/              # Markdown articles with frontmatter
│   │   └── projects/              # Markdown project descriptions
│   ├── templates/
│   │   ├── base.html              # Root HTML shell (head, nav, footer)
│   │   ├── home.html
│   │   ├── article.html
│   │   ├── article-list.html
│   │   ├── project.html
│   │   └── project-list.html
│   ├── styles/
│   │   ├── main.css               # Entry — @layer declarations + @import
│   │   ├── reset.css
│   │   ├── tokens.css
│   │   ├── typography.css
│   │   ├── layout.css
│   │   ├── nav.css
│   │   ├── components.css
│   │   └── animations.css
│   ├── ts/
│   │   ├── main.ts                # Entry — discovers and mounts modules
│   │   ├── modules/
│   │   │   ├── scroll-reveal.ts
│   │   │   ├── nav.ts
│   │   │   ├── carousel.ts
│   │   │   └── theme-toggle.ts
│   │   └── utils/
│   │       └── dom.ts
│   └── assets/
│       ├── images/
│       └── fonts/
├── build/
│   ├── build.ts
│   ├── markdown.ts
│   ├── templates.ts
│   ├── pages.ts
│   └── copy-assets.ts
├── dist/                          # Build output (gitignored)
├── netlify.toml
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── .gitignore
```
