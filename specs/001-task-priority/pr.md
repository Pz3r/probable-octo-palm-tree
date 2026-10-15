## Summary
Adds a `priority` field (`"low" | "medium" | "high"`, default `"medium"`) to tasks. `POST`/`PATCH` accept
an optional `priority` validated by a new `TaskPriority` enum via `@IsEnum`, and `GET /tasks?priority=`
filters the list (still in creation order) while rejecting unknown values with 400. Filtering lives in
`TasksRepository`/`TasksService`, not the controller, per the spec's constraint. Along the way, fixed a
latent bug in `TasksService.update` where a priority-only `PATCH` was wiping `title`/`done` to `undefined`
because class-transformer materializes unset `UpdateTaskDto` fields as explicit `undefined` before the
spread.

## Acceptance criteria
| AC | Test | File |
|---|---|---|
| AC1: create without `priority` defaults to `medium` | `AC1: creates a task without priority defaulting to medium`; `AC1: creating a task without priority returns it with priority "medium"` | `src/tasks/tasks.service.spec.ts`; `test/tasks.e2e-spec.ts` |
| AC2: create with explicit `low`/`medium`/`high` stores and returns it | `AC2: creates a task with priority %s and stores that value`; `AC2: creating a task with priority "%s" stores and returns that value` | `src/tasks/tasks.service.spec.ts`; `test/tasks.e2e-spec.ts` |
| AC3: invalid `priority` on create/update → 400 | `AC3: rejects an unknown priority on create with 400` / `...on update with 400` | `test/tasks.e2e-spec.ts` |
| AC4: `PATCH` with only `priority` changes only priority + `updatedAt` | `AC4: PATCH /tasks/:id with priority changes only priority and updatedAt` | `test/tasks.e2e-spec.ts` |
| AC5: `GET /tasks?priority=high` filters, preserves creation order | `AC5: lists only tasks matching the given priority filter, in creation order`; `AC5: GET /tasks?priority=high returns only high-priority tasks, in creation order` | `src/tasks/tasks.service.spec.ts`; `test/tasks.e2e-spec.ts` |
| AC6: `GET /tasks?priority=bogus` → 400 | `AC6: GET /tasks?priority=bogus returns 400` | `test/tasks.e2e-spec.ts` |
| AC7: `GET /tasks` without the param still returns all tasks | `AC7: lists all tasks when no priority filter is given`; `AC7: GET /tasks without the priority param still returns all tasks` | `src/tasks/tasks.service.spec.ts`; `test/tasks.e2e-spec.ts` |

## Review
spec-reviewer verdict: **PASS**. All 7 ACs genuinely satisfied (assertions checked, not just status codes);
both plan constraints honored (`TaskPriority` enum + `@IsEnum`; filtering in repo/service, not controller).
No blockers, no major findings.

One minor finding noted but not fixed: adding `@Query() query: TaskQueryDto` to `GET /tasks` means any
*unrelated* query param now triggers a 400 (global `ValidationPipe` has `forbidNonWhitelisted: true`),
where previously unrecognized params were silently ignored. Not covered by a test and not a spec
violation — AC7 only requires no-param behavior to be unchanged, which it is — but worth flagging since
`specs/003-task-search` (draft) will also add query params to `GET /tasks` and should be aware of this.
Left as-is rather than loosening validation, since silently accepting unknown params is the pattern this
repo's `ValidationPipe` config deliberately avoids.

## Notes for the reviewer
- **Bug fix outside the literal task list**: `TasksService.update` previously built `changes` via
  `{ ...dto, ... }`. Because the global `ValidationPipe` has `transform: true`, incoming `UpdateTaskDto`
  instances have every optional field materialized as an explicit `undefined` key (not simply absent), so
  a priority-only PATCH was overwriting `title`/`done` to `undefined` in the stored task. Fixed by building
  `changes` field-by-field instead of spreading `dto`. This was required to make AC4 pass; it also fixes the
  same latent bug for `done`-only and `title`-only PATCHes (previously untested).
- Fixed a timestamp-collision flake in the AC4 e2e test (`test/tasks.e2e-spec.ts`): create and patch could
  land in the same millisecond, making `updatedAt` equal `createdAt`. Added a 5ms delay between the two
  calls.
- All file changes are within the plan's file list; no files outside the plan were touched.
- `npm run check` is green (typecheck, lint, 23/23 tests).

## Review response (round 1)
| Item | Decision | What changed / why not | Test |
|---|---|---|---|
| R1-1: `priority: null` bypasses `@IsEnum`; PATCH silently stores `null` | Fix | `@IsOptional()` treats both `undefined` and `null` as "absent" in class-validator, so `{ "priority": null }` skipped `@IsEnum` on both `CreateTaskDto` and `UpdateTaskDto`. Replaced `@IsOptional()` with `@ValidateIf((_, value) => value !== undefined)` on the `priority` field of both DTOs, so only a genuinely absent field skips validation; `null` is now validated by `@IsEnum` and rejected with 400. | `test/tasks.e2e-spec.ts`: added `priority: null` cases to `AC3: rejects an unknown priority on create with 400` and `...on update with 400` (failed with 201/200 before the fix, pass now) |
