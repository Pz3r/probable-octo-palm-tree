# agent-lab

NestJS 11 + TypeScript (strict) REST API. In-memory storage, no external services.
Sandbox for practicing spec-driven, multi-agent workflows.

## Commands
- `npm run check` — typecheck + lint + all tests. Must pass before you say you're done.
- `npm test -- <pattern>` — run a subset of tests
- `npm run dev` — start on :3000

## Workflow (spec-driven)
Work comes from `specs/NNN-slug/spec.md`. The spec is the source of truth:
if code and spec disagree, change the code. Never edit an approved spec; if it is
wrong or ambiguous, stop and ask the human.
- `/spec` drafts a spec · `/plan` writes plan.md + tasks.md · `/implement` builds it · `/review` checks it
- Tests first: acceptance criteria become failing tests before implementation.
- Commit after each task in tasks.md (conventional commits: feat/fix/test/refactor/chore).

## Conventions
- One Nest module per feature under `src/<feature>/` — see the `nestjs-conventions` skill.
- Validate all input with class-validator DTOs; the global ValidationPipe rejects unknown fields.
- Throw Nest HTTP exceptions from services; controllers stay thin.
- Unit tests next to the code (`*.spec.ts`); HTTP tests in `test/*.e2e-spec.ts`.
- No `any`, no `console.log`.

## Don't touch
`.env*`, `package-lock.json` (use npm commands), `.github/workflows/`, `.claude/hooks/` — hooks enforce this.
