# Phase 0 — Meta setup (Claude Code workflow layer)

**Status:** Completed in the setup session on 2026-04-09. This file exists so the prompt sequence starts at 00 and so future sessions can understand what the meta layer is and why it exists.

## Goal

Build a project-specific Claude Code workflow *before* writing any application code, so every subsequent phase (01–06) runs the same way: predictable session boundaries, predictable specialist agents, predictable context handoff between sessions.

Phase 0 produces zero lines of app code. Its entire output is the **meta layer** — the files Claude Code reads at session start and end.

## Why a meta layer at all

- **Context decay between sessions.** Claude Code sessions are stateless. Without a deliberate handoff, every new session re-derives context from whatever files happen to be open.
- **Consistency across phases.** Six phases across six sessions will drift unless there's a shared rulebook (`CLAUDE.md`) and predictable delegation targets (subagents).
- **Learn the Claude Code primitives.** Matt is new to Claude Code. Setting up subagents, skills, and the progress-tracker flow in Phase 0 means every subsequent phase is also a hands-on test of those primitives.

## What Phase 0 produces

### 1. `CLAUDE.md` at the project root

The single source of truth for project rules. Auto-loaded by Claude Code on every session in this directory. Contains:

- Stack: TS 5.8+, native CSS, esbuild, Node 22+, Netlify. Hard rules (no React/Sass/Tailwind/CSS-in-JS).
- Modern TypeScript rules: ES2024 target, `satisfies`, `import type`, `erasableSyntaxOnly`, no `any`.
- Modern CSS rules: `@layer`, `oklch()`, native nesting, `:has()`, container queries, logical properties.
- **Philosophy clarification:** "conservative" means no runtime frameworks/dependencies. It does *not* mean "avoid modern language features" — use the latest TS/ES/CSS freely.
- Directory ownership table — which specialist subagent owns which path.
- Session workflow: `/start-session` at the beginning, `/end-session` at the end.
- Phase roadmap pointing to `docs/prompts/0X-*.md`.
- Voice rules: first person, authentic, distinctive palette (no purple gradients, no Inter/Roboto/Space Grotesk).

### 2. `.claude/agents/` — six specialist subagents

Each subagent is a `.md` file with YAML frontmatter (`name`, `description`, `tools`, `model`) and a system prompt that defines scope and rules.

| Subagent | Owns | Never touches |
|---|---|---|
| `build-specialist` | `build/`, `package.json`, `tsconfig*.json`, `netlify.toml` | `src/styles/`, `src/ts/`, templates |
| `css-specialist` | `src/styles/` | everything else |
| `ts-specialist` | `src/ts/` | everything else |
| `content-specialist` | `src/templates/`, `src/content/` | TypeScript, CSS |
| `reviewer` | read-only — runs builds, type checks, reports | writes nothing |
| `progress-tracker` | `docs/progress.md`, `docs/knowledge-base.md`, `docs/decisions.md` | app code |

The main agent delegates to these by `description` field. Each specialist enforces domain-specific rules (e.g. `css-specialist` blocks Sass/PostCSS/CSS-in-JS; `ts-specialist` blocks `any`/enums/namespaces).

### 3. `.claude/skills/` — two session-boundary skills

Skills (not `commands/`) because Claude Code's skills layout has live change detection — edits are picked up mid-session without restart.

- **`.claude/skills/start-session/SKILL.md`** → invoked as `/start-session`. Reads `CLAUDE.md`, `docs/progress.md`, and the current phase prompt. Reports status, last session's accomplishments, next step, and recommended subagent.
- **`.claude/skills/end-session/SKILL.md`** → invoked as `/end-session` (or triggered by "prepare to end session"). Produces a structured handoff package, shows it for review, then delegates writing to the `progress-tracker` subagent.

### 4. `docs/` — growing context store

- **`docs/progress.md`** — phase checklist + last-session / next-step summary. Owned by `progress-tracker`, edited only via `/end-session`. Never hand-edited mid-session.
- **`docs/knowledge-base.md`** — long-lived learnings, gotchas, non-obvious technical facts. Appended to across the life of the project.
- **`docs/decisions.md`** — dated ADR-lite log. Each entry: date, decision, context, consequences.
- **`docs/prompts/00-06-*.md`** — phase spec files. Each session reads its corresponding prompt.

### 5. Memory pointers at `~/.claude/projects/-Users-mnoth-source-mattnoth-dev/memory/`

- **`project_matt_site.md`** — reminds future sessions that matt-site lives at `/Users/mnoth/source/mattnoth-dev/` and points at `CLAUDE.md` + `docs/progress.md`.
- **`reference_end_session.md`** — documents the `/start-session` / `/end-session` flow and which files `progress-tracker` owns.
- **`user_modern_syntax.md`** — user-level preference: Matt defaults to latest TS/ES/CSS/Node syntax. "Conservative" means no runtime frameworks, not no modern features.
- **`MEMORY.md`** — index of the above.

### 6. `.gitignore`-worthy byproducts

- `.claude/settings.local.json` — auto-created by Claude Code to persist tool-permission approvals. Harmless, machine-local, should be gitignored in Phase 1.

## Decisions made in Phase 0

These are logged separately in `docs/decisions.md` but summarized here for completeness:

1. **Use ES2024 / Node 22+ across the stack.** Build scripts target `ESNext` / `NodeNext`; browser targets ES2024 with `lib: ["ES2024", "DOM", "DOM.Iterable"]`. No downleveling anywhere. Rationale: conservative ethos is about dependencies, not language features.
2. **Package name: `matthew-noth-dev-site`** (not `matt-site`). Matt's explicit choice.
3. **Skills layout, not commands layout.** `.claude/skills/<name>/SKILL.md` wins over `.claude/commands/<name>.md` because of live change detection. The harness routes all `/foo` invocations through the Skills system anyway.
4. **Six specialist subagents with hard directory ownership.** Preferred over a single main agent doing everything, because it forces the rules into the subagent system prompts (harder to forget) and it makes each session's "who should handle this?" answer explicit.
5. **Progress tracker owns three docs files.** No hand-editing of `docs/progress.md` mid-session. All session-handoff writes go through `/end-session` → `progress-tracker`.

## What Phase 0 does NOT produce

No `package.json`. No `src/`. No `build/`. No `dist/`. No `node_modules/`. Those are Phase 1's job.

## How to know Phase 0 is done

Run `/start-session` in a fresh Claude Code session in `/Users/mnoth/source/mattnoth-dev/`. If it:

- Reads `CLAUDE.md` and `docs/progress.md` without errors,
- Reports "Phase 1 — Project scaffold & config" as the next phase,
- Names `build-specialist` as the recommended subagent for Phase 1,

…then the meta layer is working end-to-end and Phase 1 can begin.
