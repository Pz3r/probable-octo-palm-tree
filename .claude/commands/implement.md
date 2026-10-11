---
description: Implement an approved, planned spec — tests first, task by task, then independent review
argument-hint: <specs/NNN-slug>
---

Implement $ARGUMENTS.

Preconditions — stop and tell me if any fail:
- `$ARGUMENTS/spec.md` has `status: approved`
- `$ARGUMENTS/plan.md` and `$ARGUMENTS/tasks.md` exist (otherwise run the /plan steps first, then continue)
- You're not on `main` (otherwise create and switch to branch `agent/<slug>`)

Loop:
1. Use the **test-writer** subagent to write failing tests for every acceptance criterion.
   Commit: `test(<slug>): acceptance tests`.
2. Work through `tasks.md` in order. For each task: implement it, run the relevant tests,
   tick its checkbox, commit (`feat(<slug>): …`). Keep changes inside the plan's file list;
   if you need to go outside it, say why in the commit message.
3. Run `npm run check`. Fix until green.
4. Use the **spec-reviewer** subagent on $ARGUMENTS. Fix every blocker and major finding,
   re-run the checks, and commit. Run the reviewer once more if you made non-trivial changes.

If the spec turns out to be impossible or contradictory, stop and explain — never edit an approved spec.

Finish with: what was built, the AC → test mapping, reviewer verdict, and anything you're unsure about.
