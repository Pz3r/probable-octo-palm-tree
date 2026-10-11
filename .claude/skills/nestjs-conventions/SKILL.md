---
name: nestjs-conventions
description: How features are structured in this NestJS repo — module layout, DTOs, validation, errors and tests. Use when adding or changing a feature module, endpoint or DTO.
---

# NestJS conventions for agent-lab

## Layout
```
src/<feature>/
  <feature>.module.ts       # registers controller + providers
  <feature>.controller.ts   # HTTP only: routes, pipes, status codes
  <feature>.service.ts      # business rules, throws Nest HTTP exceptions
  <feature>.repository.ts   # storage (in-memory Map today)
  <entity>.entity.ts        # plain interface
  dto/create-<x>.dto.ts, dto/update-<x>.dto.ts, dto/<x>-query.dto.ts
  <feature>.service.spec.ts
test/<feature>.e2e-spec.ts
```
Register new modules in `src/app.module.ts`. Use `src/tasks/` as the reference implementation.

## Rules
- Controllers are thin: no logic beyond calling the service.
- Every input goes through a DTO with class-validator decorators. Use `!` for required fields,
  `?` + `@IsOptional()` for optional ones.
- Query params: a DTO with `@Type(() => Number)` (class-transformer) for numbers, since the
  global ValidationPipe has `transform: true`.
- Enums: `export enum X { … }` in the entity file + `@IsEnum(X)` in DTOs.
- Route ids are UUIDs: use `ParseUUIDPipe`.
- Not found → `NotFoundException`; business-rule violation → `BadRequestException` or `ConflictException`.
- Responses are the entity objects directly (no envelope) unless the spec says otherwise.
  Paginated lists return `{ items, total, limit, offset }`.

## Tests
- Unit-test services by constructing them directly with a real in-memory repository (no mocks needed).
- E2E tests build the app with `configureApp(app)` from `src/app.setup.ts` so validation matches prod.
- Prefix test names with the acceptance criterion: `it('AC3: …')`.
