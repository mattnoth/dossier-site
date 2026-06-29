# Phase 5 — Content & Templates

**Owner subagent:** `content-specialist`

---

## Task: Create HTML templates and sample content

### Templates (src/templates/)

#### base.html
- Full HTML5 document:
  - <meta charset="utf-8">, <meta name="viewport">, <meta name="description" content="{{description}}">
  - Open Graph: og:title, og:description, og:type, og:url
  - <link rel="stylesheet" href="/main.css">
  - <script type="module" src="/main.js"></script>
- <body>:
  - <a href="#content" id="skip-link">Skip to content</a>
  - <header> with nav (data-module="nav"):
    - Site name/logo link to /
    - Nav links: Articles, Projects, About
    - Theme toggle button (data-module="theme-toggle", aria-label="Toggle theme")
    - Mobile hamburger toggle (CSS-only via hidden checkbox)
  - <main id="content">{{content}}</main>
  - <footer>: © 2026 Matt · social links (GitHub, LinkedIn, Twitter/X) · "Built with vanilla TS + CSS"
- Use semantic HTML throughout
- All interactive components have appropriate data-module attributes

#### home.html
- Hero section: name (Matt), one-line title ("Software Engineer. Context Engineer. Music Maker."), brief 2-sentence intro
- "Recent Articles" section heading + {{recent_articles}} slot (3 most recent)
- "Featured Projects" section heading + {{featured_projects}} slot
- Sections use data-reveal="fade-up" for scroll animation

#### article.html
- <article> wrapper
- Header: <h1>{{title}}</h1>, <time datetime="{{date}}">{{formatted_date}}</time>, {{reading_time}} min read, tag pills
- <div class="prose">{{content}}</div>
- Back link: ← Back to articles

#### article-list.html
- <h1>Articles</h1>
- {{articles}} slot containing article cards
- Each card: linked title, date, description, tags

#### project.html
- Header: <h1>{{title}}</h1>, tech tags, optional links (Live ↗, GitHub ↗)
- <div class="prose">{{content}}</div>
- Back link: ← Back to projects

#### project-list.html
- <h1>Projects</h1>
- {{projects}} slot containing project cards in a grid

### Sample content — scaffolding only

Create the four markdown files with **real frontmatter** (title, date, tags, description, slug) and **lorem ipsum body text** — ~50 words max per file. Each body should contain clearly labeled section markers in square brackets so it's obvious what Matt will write there later. **Do not write real prose in Matt's voice.** Matt writes the real articles after Phase 6.

Example shape:

````markdown
---
title: "Building This Site with Vanilla TS and Modern CSS"
slug: "building-this-site"
date: "2026-04-07"
tags: ["typescript", "css", "static-site"]
description: "Why I ditched React and built my personal site with zero framework runtime."
---

[intro paragraph — why I ditched Next.js] Lorem ipsum dolor sit amet, consectetur adipiscing elit.

[code example section — TS module pattern or CSS nesting] Lorem ipsum.

[closing paragraph — lessons learned] Lorem ipsum dolor sit amet.
````

Files to scaffold (frontmatter is real, body is lorem ipsum + section labels):

- `src/content/articles/building-this-site.md` — tags `["typescript", "css", "static-site"]`, description about ditching React for zero framework runtime
- `src/content/articles/modern-css-is-amazing.md` — tags `["css", "web-development", "frontend"]`, description about native nesting, `:has()`, container queries, scroll-driven animations
- `src/content/projects/context-base.md` — `tech: ["typescript", "markdown", "ai", "knowledge-engineering"]`, `featured: true`, description "A structured markdown knowledge repository for grounding AI agents in domain expertise."
- `src/content/projects/mcp-snowflake.md` — `tech: ["typescript", "snowflake", "mcp", "ai"]`, description about an MCP server for natural-language Snowflake querying

The frontmatter is real because the build parses it and the list pages render title/date/tags/description. The body is disposable — Matt drops real articles in later.

### Rules
- All HTML is semantic and accessible
- data-module attributes on interactive elements
- data-reveal attributes on scroll-animated sections
- Templates are minimal — structure and slots only, no inline styles
- Content should feel real and personal, not placeholder lorem ipsum
