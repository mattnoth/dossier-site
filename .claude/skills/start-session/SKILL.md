---
name: start-session
description: Start a matt-site work session. Reads CLAUDE.md, docs/progress.md, and the current phase prompt; reports phase status and the concrete next step. Use at the beginning of any session in /Users/mnoth/source/mattnoth-dev/.
---

A new work session is starting. Do this in order:

1. **Read `CLAUDE.md`** at the project root so you have the full rule set in context.
2. **Read `docs/progress.md`** to see the current phase status, last session summary, and next-session plan.
3. **Read the top of `docs/knowledge-base.md`** (the section index — you can skim specific sections later if they become relevant).
4. **If a phase is in progress or about to start**, read the relevant `docs/prompts/0X-*.md` file so the phase spec is in context.
5. **Report to me** in this format:

```
## Session start — [today's date]

**Current phase:** [phase name, e.g. "Phase 2 — Build system"]
**Status:** [not started | in progress | blocked | complete]

**Last session accomplished:**
- [bullet]
- [bullet]

**Next step:**
[the single concrete next action from docs/progress.md]

**Open questions / blockers:**
- [any from docs/progress.md]

**Recommended subagent for this work:**
[which specialist subagent should handle the next step, based on CLAUDE.md's directory ownership table]
```

6. **Immediately proceed to the next step.** Do not pause to ask for confirmation — delegate to the recommended specialist subagent right after reporting. If the next step is genuinely ambiguous or blocked, flag it in the report instead and then stop.
