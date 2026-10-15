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
| Parallel agents | `scripts/worktree.mjs` | One worktree + branch per spec; headless runs that end in a **draft PR**. Agents never push; the script does, after re-checking. |
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

### 4. Headless fan-out ending in draft PRs (overnight style)
One-time setup: create a GitHub repo, `git remote add origin …`, `git push -u origin main`,
`gh auth login`, and add the `DEEPSEEK_API_KEY` secret for the AI review (exercise 6).
```bash
node scripts/worktree.mjs run 001-task-priority 002-health-endpoint
node scripts/worktree.mjs status                      # progress of every agent
node scripts/worktree.mjs logs 002-health-endpoint    # live activity, follows until the agent exits
```
`status` shows, per agent: running/finished, elapsed and idle time, tool calls and errors, ticked
tasks from `tasks.md`, the last commit, what it's doing right now, cost when finished, and the PR
link. Agents idle for more than 15 minutes are flagged (`AGENT_STALE_MIN` to change it). `logs`
reads like this:
```
10:42:03  Read    src/tasks/tasks.service.ts
10:42:09  Agent   test-writer: Write failing tests for AC1–AC7
10:42:15    ↳ Write   src/tasks/tasks.service.spec.ts
10:43:30  Bash    npx jest tasks
10:43:31  ✗ 5 failed, 7 passed
10:58:40  ■ Finished: success · 41 turns · 16m 37s · $1.12
```
Raw events are in `.worktrees/<slug>.events.jsonl` (`logs <slug> --raw`). On macOS you get a desktop
notification when an agent finishes (`AGENT_NOTIFY=0` to turn it off). Add
`watch -n 15 node scripts/worktree.mjs status` (`brew install watch`) for a self-refreshing view.
`run` skips specs that aren't approved. When an agent finishes successfully, the script (not the
agent) re-runs `npm run check`, pushes `agent/<slug>` and opens a **draft PR** using the agent's
`specs/<slug>/pr.md` as the description. If the branch touches tooling files (package.json, configs,
`scripts/`, `.claude/`, `.github/`), the PR says so. Failed or dirty runs get no PR.

- Keep the branch local: `run <slug> --no-pr`
- Review the plan before any code is written:
  ```bash
  node scripts/worktree.mjs run 001-task-priority --plan-only   # agent writes + commits plan.md/tasks.md, stops
  node scripts/worktree.mjs status                              # 📝 plan awaiting review
  $EDITOR .worktrees/001-task-priority/specs/001-task-priority/plan.md   # read it, edit it if you like
  node scripts/worktree.mjs approve-plan 001-task-priority      # commits your edits + status: approved
  node scripts/worktree.mjs run 001-task-priority               # implements against the approved plan → draft PR
  ```
  `run` refuses while a plan is still `draft`, and agents can't approve plans or edit approved ones.

#### Review loop: PR feedback back to the agent
Reviewer comments (the AI review or people) are input for *you* to triage, not instructions to forward:
the reviewer can be wrong or out of scope, two AIs can ping-pong forever, and anyone who can comment
on a PR could write "also delete the auth check".
```bash
node scripts/worktree.mjs feedback 001-task-priority      # PR comments → .worktrees/001-task-priority.feedback.md
# tick [x] the items to address, add guidance under an item or in "Your notes"
node scripts/worktree.mjs run 001-task-priority --fix     # agent fixes/skips each ticked item, pushes to the same PR
```
- The AI review comment is split into one item per finding; inline and human comments are items too.
  Later rounds only show comments that arrived since the previous round.
- Only ticked items and your notes reach the agent, written to `specs/<slug>/feedback.md` (committed,
  so the PR shows exactly what was asked). Quoted text is passed as untrusted reviewer input.
- `/address-review` writes a test + fix per accepted item (or skips with a reason if it conflicts with
  the spec) and appends a "Review response (round N)" table to the PR description.
- The push updates the PR's commits and description and triggers a fresh AI review.
- After 2 rounds (`AGENT_MAX_FIX_ROUNDS`), `status` says the PR needs a human decision; `--fix
  --extra-round` overrides.
  Without `--plan-only`, the agent plans and implements in one go (the approved spec is the gate).
- Open or update the PR by hand (e.g. after an interactive session): `node scripts/worktree.mjs pr <slug>`
  (`--ready` for a non-draft PR) Pass extra Claude flags with `CLAUDE_ARGS`, e.g.
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
Push to GitHub, add a `DEEPSEEK_API_KEY` repository secret (optionally a `DEEPSEEK_MODEL` variable),
and open a PR from an `agent/*` branch. `claude-review.yml` runs the Claude Code CLI against DeepSeek's
Anthropic-compatible API and posts the `spec-reviewer` report as a PR comment.

## Cleaning up
```bash
node scripts/worktree.mjs rm 001-task-priority --delete-branch
```
`--delete-branch` removes the local branch only. Delete the remote `agent/*` branch from the PR page after merging.

## Things to experiment with
- Make CLAUDE.md longer or shorter and see whether results change.
- Remove the Stop hook and count how often the agent says "done" with failing tests.
- Give the reviewer a different model than the implementer (`model:` in the agent frontmatter).
- Feed a spec from your Kepler TODO list into `worktree.mjs run`.
