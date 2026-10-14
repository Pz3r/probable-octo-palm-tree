---
spec: 001-task-priority
---

# Plan

## Approach
Add a `TaskPriority` enum (`low | medium | high`) to the task entity and thread it through the
existing CRUD surface: `CreateTaskDto` gets an optional `priority` (defaulted to `medium` in the
service), `UpdateTaskDto` gets an optional `priority`, and a new `TaskQueryDto` validates the
`?priority=` query param on `GET /tasks`. Filtering by priority happens in `TasksRepository.findAll`,
which already owns sorting by creation order — adding an optional filter there keeps the controller
and service thin and satisfies the spec's "filtering happens in the repository/service" constraint.
Invalid values (bad enum, wrong type) are rejected by `@IsEnum(TaskPriority)` via the global
`ValidationPipe`, so no manual validation code is needed for AC3/AC6.

Default assignment (`dto.priority ?? TaskPriority.Medium`) happens in `TasksService.create`, not the
repository or DTO, so the repository's `create`/`update` signatures stay simple pass-throughs and the
"default" business rule lives in one place.

### Alternatives rejected
- Validate priority manually in the service instead of `@IsEnum`: rejected — duplicates what
  class-validator already does and diverges from the repo's DTO-validation convention.
- Filter in the controller: rejected — spec explicitly forbids this.
- Default `priority` inside `TasksRepository.create`: rejected — keeps the "medium default" business
  rule out of storage, consistent with how `title.trim()` is done in the service today.

## Files to create / modify
- `src/tasks/task.entity.ts` — add `TaskPriority` enum, add `priority: TaskPriority` to `Task`.
- `src/tasks/dto/create-task.dto.ts` — add optional `priority` with `@IsEnum(TaskPriority)`.
- `src/tasks/dto/update-task.dto.ts` — add optional `priority` with `@IsEnum(TaskPriority)`.
- `src/tasks/dto/task-query.dto.ts` (new) — `priority?: TaskPriority` with `@IsOptional() @IsEnum(TaskPriority)`.
- `src/tasks/tasks.repository.ts` — `findAll` takes an optional `{ priority?: TaskPriority }` filter;
  `create`/`update` accept `priority` in their changes.
- `src/tasks/tasks.service.ts` — `list` takes `TaskQueryDto` and forwards to repo; `create` defaults
  `priority` to `medium` when absent.
- `src/tasks/tasks.controller.ts` — `list` takes `@Query() query: TaskQueryDto`.
- `src/tasks/tasks.service.spec.ts` — extend with priority cases.
- `test/tasks.e2e-spec.ts` — extend with priority HTTP cases.

## Data / API shape changes
- `Task` gains `priority: TaskPriority` (non-optional on the stored entity, always populated).
- `POST /tasks` and `PATCH /tasks/:id` accept optional `priority`; invalid value → 400.
- `GET /tasks?priority=<value>` filters the array response; invalid value → 400. No change to the
  response shape (still a bare array) — this matches AC7 and avoids touching 003's territory.

## Risks / conflicts
- `specs/003-task-search` (status: `draft`, unresolved open questions) will also add query params to
  `GET /tasks` and may change the response from a bare array to `{ items, total, limit, offset }`.
  This plan keeps the array response, so 003 will need to merge its envelope change around this
  filter later — no action needed now since 003 isn't approved.
- `specs/002-health-endpoint` touches `src/health/` only — no overlap.
