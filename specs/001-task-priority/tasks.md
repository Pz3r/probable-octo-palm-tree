---
spec: 001-task-priority
---

# Tasks

- [x] Write failing tests for all acceptance criteria (test-writer).
      Verify: `npm run check` shows new tests failing for the right reason (missing `priority` support).
- [ ] Add `TaskPriority` enum and `priority` field to `Task` entity.
      Verify: `npm run check` compiles (typecheck passes for entity usage so far).
- [ ] Add optional `priority` (`@IsEnum(TaskPriority)`) to `CreateTaskDto` and `UpdateTaskDto`.
      Verify: AC2/AC3-related unit tests for DTO validation pass.
- [ ] Add `TaskQueryDto` with optional `priority` (`@IsOptional() @IsEnum(TaskPriority)`).
      Verify: AC6 test (invalid query value → 400) passes.
- [ ] Update `TasksRepository`: `findAll` accepts an optional priority filter; `create`/`update` accept `priority`.
      Verify: repository-level behaviour covered by `TasksService` unit tests (AC1, AC2, AC4, AC5).
- [ ] Update `TasksService`: default `priority` to `medium` in `create`; thread `TaskQueryDto` through `list`.
      Verify: `npm test -- tasks.service` passes (AC1, AC2, AC4, AC5).
- [ ] Update `TasksController`: accept `@Query() query: TaskQueryDto` in `list`.
      Verify: `npm test -- tasks.e2e` passes (AC5, AC6, AC7).
- [ ] Run `npm run check` and fix any typecheck/lint/test failures.
      Verify: `npm run check` is green.
- [ ] Independent review (spec-reviewer).
      Verify: blockers and major findings resolved, `npm run check` still green.
