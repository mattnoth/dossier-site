---
name: end-session
description: End a dossier-site work session cleanly. Produces a single copy-pastable handoff block and appends it to SESSIONS.md. Use at the end of any session, or when the user says "prepare to end session" / "wrap up".
---

**Model:** generate handoffs on **Haiku 4.5** (`claude-haiku-4-5`) — this is extraction +
formatting over existing context, not reasoning, so the cheapest capable model is ideal and
saves tokens on the context-heavy wrap-up turn. Step up to Sonnet 4.6 only for a board-facing
milestone you want polished. Switch with `/model` before running this; note `/fast` does
**not** save cost (it's still Opus). If the wrap-up turn is running on a larger model, you may
delegate the block to a Haiku subagent.

End this work session cleanly. Do this in order:

1. **Assemble the handoff** from your actual tool history (don't guess) with these fields:
   - **Date** — today's actual date (YYYY-MM-DD)
   - **Session focus** — one line on what this session was about
   - **Accomplished** — 3–8 bullets of what was built/changed, with file paths
   - **Files touched** — full list
   - **Decisions** — non-obvious choices, each with a one-line "why"
   - **Verification** — what you ran/checked and the result (build, typecheck, render, leak grep, etc.)
   - **Gotchas** — non-obvious things future-me needs (not what's obvious from the code)
   - **Open / blockers** — flagged items, unresolved questions, anything blocking
   - **Next step** — the concrete next action (not "continue" — e.g. "set SITE_ORIGIN + Netlify domain, then Step 8 relink")

2. **Output it as ONE copy-pastable fenced code block** (```` ```text ````), so it can be
   copied in a single click. Keep it tight — this is a handoff, not a report. Put a short
   prose line above the block, nothing below it except the SESSIONS.md confirmation.

3. **Append the same block to `SESSIONS.md`** at the repo root (create it if missing, newest
   entry on top under a `## YYYY-MM-DD` heading) so there's a running ledger.

4. **Surface git state, don't commit.** Run `git status --short` and note what's outstanding
   in the handoff. Do NOT commit or push unless the user explicitly asks — this repo is
   reviewed before commits.

5. **Do not start new work, builds, or fixes after this point.** If the build is broken, say
   so under "Open / blockers" rather than fixing it in the closing session.
