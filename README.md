# agent-lab

A small NestJS API used as a sandbox for practicing agentic development with Claude Code:
spec-driven development, tests-first, hooks as guardrails, subagents, parallel agents on git
worktrees, and an agent review lane in CI.

The app itself is deliberately boring (an in-memory tasks API) so the workflow is what you learn.

```bash
npm install
npm run check   # typecheck + lint + tests
npm run dev     # http://localhost:3000/tasks
```

## What's in the kit

| Piece | File(s) | Technique |
|---|---|---|
| Project memory | `CLAUDE.md` | Lean standing instructions: commands, workflow, conventions. ~35 lines on purpose. |
| Skill | `.claude/skills/nestjs-conventions/` | Detailed conventions loaded only when relevant, keeping base context small. |
| Specs | `specs/_template.md`, `specs/NNN-*/spec.md` | Spec-driven development. The spec is the contract, with numbered acceptance criteria. |
| Commands | `.claude/commands/{spec,plan,implement,review}.md` | A repeatable explore → plan → implement → verify loop. |
| Subagents | `.claude/agents/test-writer.md`, `spec-reviewer.md` | Separate writer/reviewer roles. The reviewer never sees the implementation chat. |
| Hooks | `.claude/hooks/*.mjs`, wired in `.claude/settings.json` | Deterministic guardrails (see below). |
| Permissions | `.claude/settings.json` | Allow-list for safe commands, deny-list for destructive ones. |
| Parallel agents | `scripts/worktree.mjs` | One worktree + branch per spec; optional headless runs. |
| CI | `.github/workflows/ci.yml`, `claude-review.yml` | Same `npm run check` gate for humans and agents, plus an AI review lane for `agent/*` PRs. |

### Hooks

| Event | Hook | What it does |
|---|---|---|
| PreToolUse (Edit/Write) | `guard-paths.mjs` | Blocks edits to `.env*`, the lockfile, CI workflows, the hooks themselves, and any spec with `status: approved`. |
| PostToolUse (Edit/Write) | `post-edit-check.mjs` | After each `.ts` edit: prettier + `eslint --fix`, then `tsc`. Remaining errors go back to Claude immediately. |
| Stop | `stop-verify.mjs` | If `src/` or `test/` changed, Claude can't finish its turn until `npm run check` passes. |

The hooks are plain Node scripts with no `jq` dependency, so they work on macOS, Linux and Windows.
To skip the Stop gate during exploration, add this to `.claude/settings.local.json`:
`{ "env": { "SKIP_STOP_VERIFY": "1" } }`.

## Exercises

Do these in order. Each one builds on the last.

### 1. Watch the guardrails work (5 min)
Open Claude Code in the repo and try:
- *"Add a `console.log` to TasksService.create"* — the PostToolUse hook reports the lint error back, and Claude has to fix it.
- *"Change spec 001 so priority defaults to low"* — the PreToolUse hook blocks it, because the spec is approved.
- *"Read .env"* — denied by permissions.

Run `/hooks` inside Claude Code to see what's registered.

### 2. One spec, full loop, interactive (30 min)
Spec 001 (task priority) is approved and ready.
```
git switch -c agent/001-task-priority
/plan specs/001-task-priority        # read plan.md + tasks.md, push back if you disagree
/implement specs/001-task-priority
```
Pay attention to:
- whether the test-writer's tests actually failed first (check the commit history)
- whether the reviewer found anything
- how many times the hooks sent errors back

### 3. Two agents in parallel (20 min)
Specs 001 and 002 touch different files, so they can safely run at the same time.
Start from a clean main, without your exercise-2 branch:
```bash
node scripts/worktree.mjs new 001-task-priority 002-health-endpoint
# open two terminals or VS Code windows, one per .worktrees/<slug>, run /plan then /implement in each
node scripts/worktree.mjs status
```
Then merge both branches into main yourself and run `npm run check`.

### 4. Headless fan-out (overnight style)
```bash
node scripts/worktree.mjs run 001-task-priority 002-health-endpoint
node scripts/worktree.mjs status       # come back later
tail -f .worktrees/002-health-endpoint.log
```
`run` skips specs that aren't approved. Pass extra Claude flags with `CLAUDE_ARGS`, e.g.
`CLAUDE_ARGS="--model sonnet" node scripts/worktree.mjs run 002-health-endpoint` to try cheaper
models on simple specs.

Compare the headless result with your interactive one from exercise 2. Where did it need you?

### 5. Write and approve a spec (30 min)
Spec 003 (search + pagination) is a `draft` with open questions, and one of them is a breaking API change.
- Answer the open questions in the spec, tighten the acceptance criteria, then set `status: approved` yourself.
- Implement it on top of 001, which also changes `GET /tasks`. This is a deliberate conflict.
  Notice how the plan's "Risks / conflicting specs" section helps, or doesn't.

Then try `/spec` on your own idea, e.g. *"swap the in-memory repository for Postgres via Supabase"*.

### 6. Agent lane in CI (optional)
Push to GitHub, run `/install-github-app` in Claude Code, add an `ANTHROPIC_API_KEY` secret, and
open a PR from an `agent/*` branch. `claude-review.yml` posts a spec-compliance review.

## Cleaning up
```bash
node scripts/worktree.mjs rm 001-task-priority --delete-branch
```

## Things to experiment with
- Make CLAUDE.md longer or shorter and see whether results change.
- Remove the Stop hook and count how often the agent says "done" with failing tests.
- Give the reviewer a different model than the implementer (`model:` in the agent frontmatter).
- Feed a spec from your Kepler TODO list into `worktree.mjs run`.
