---
description: Implement an approved, planned spec — tests first, task by task, then independent review
argument-hint: <specs/NNN-slug>
---

Implement $ARGUMENTS.

Preconditions — stop and tell me if any fail:
- `$ARGUMENTS/spec.md` has `status: approved`
- You're not on `main` (otherwise create and switch to branch `agent/<slug>`)

Setup (don't stop for approval here; the approved spec is the human gate):
- If `$ARGUMENTS/plan.md` or `$ARGUMENTS/tasks.md` is missing, write them following steps 2–4 of
  `.claude/commands/plan.md`, but skip its "wait for my go-ahead". Then continue.
- If plan.md, tasks.md or other files under `$ARGUMENTS/` are uncommitted (yours or from an earlier
  run), commit them now: `docs(<slug>): plan`.

Loop:
1. Use the **test-writer** subagent to write failing tests for every acceptance criterion.
   Commit: `test(<slug>): acceptance tests`.
2. Work through `tasks.md` in order. For each task: implement it, run the relevant tests,
   tick its checkbox, commit (`feat(<slug>): …`). Keep changes inside the plan's file list;
   if you need to go outside it, say why in the commit message.
3. Run `npm run check`. Fix until green.
4. Use the **spec-reviewer** subagent on $ARGUMENTS. Fix every blocker and major finding,
   re-run the checks, and commit. Run the reviewer once more if you made non-trivial changes.

5. Write the PR description to `$ARGUMENTS/pr.md` and commit it (`docs(<slug>): PR description`):
   - `## Summary`: what changed and why, in 3–5 lines
   - `## Acceptance criteria`: table AC → test name → file
   - `## Review`: the spec-reviewer verdict and anything you chose not to fix (with why)
   - `## Notes for the reviewer`: risks, assumptions, files outside the plan
   Leave the working tree clean. You don't push or open the PR; `scripts/worktree.mjs` does that
   after re-running `npm run check`.

If the spec turns out to be impossible or contradictory, stop and explain — never edit an approved spec.
In that case don't write `pr.md` and exit with the explanation, so no PR is opened.

Finish with: what was built, the AC → test mapping, reviewer verdict, and anything you're unsure about.
