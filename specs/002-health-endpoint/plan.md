# Plan: Health endpoint

## Approach
Add a new `HealthModule` under `src/health/` following the standard module/controller/service
layout (no repository — there's nothing to store). `HealthService` captures `startTime = Date.now()`
in its constructor and computes `uptimeSeconds = Math.floor((Date.now() - startTime) / 1000)` on
each call, so tests can drive it with `jest.useFakeTimers()` / `jest.setSystemTime()` without any
extra abstraction. `version` is read from `package.json`'s `version` field via a typed JSON import
(`import { version } from '../../package.json'`), which requires turning on
`resolveJsonModule` in `tsconfig.json`. `HealthController` exposes `GET /health` and returns the
plain object directly — no DTO needed since there's no input. Register `HealthModule` in
`AppModule`'s imports, alongside `TasksModule`.

### Alternatives rejected
- `@nestjs/terminus` — explicitly forbidden by the spec's constraints (no new dependencies).
- `process.uptime()` — measures the whole Node process's uptime (including anything before Nest
  bootstraps), not the service's own lifetime, and is harder to control in unit tests than a
  plain `Date.now()` field.
- `fs.readFileSync` + `JSON.parse` for the version — avoids the tsconfig change, but the relative
  path differs subtly between source and compiled output in edge cases and adds needless I/O for
  a value that's already statically available at compile time.

## Files to create / modify
**Create**
- `src/health/health.module.ts`
- `src/health/health.controller.ts`
- `src/health/health.service.ts`
- `src/health/health.entity.ts` — `HealthStatus` interface: `{ status: 'ok'; uptimeSeconds: number; version: string }`
- `src/health/health.service.spec.ts`
- `test/health.e2e-spec.ts`

**Modify**
- `src/app.module.ts` — register `HealthModule`
- `tsconfig.json` — add `"resolveJsonModule": true` (outside the plan's `src/health/` scope,
  but required to statically import `version` from `package.json`; it's a compiler-only flag with
  no runtime behaviour change elsewhere, so it's low-risk for the rest of the codebase)

## Data / API shape
```
GET /health
→ 200 { "status": "ok", "uptimeSeconds": 0, "version": "1.0.0" }
```
No request body, no query params, no DTO. Response is a plain object with exactly three fields
(enforced by the service constructing a literal object, not spreading anything).

## Risks / conflicts
- The `tsconfig.json` edit is global but additive (`resolveJsonModule` only affects how JSON
  imports are typed); it shouldn't change behaviour for `src/tasks/` or any other module.
- No other spec in `specs/` touches `src/health/`, `app.module.ts`, or `tsconfig.json`.
  `001-task-priority` and `003-task-search` only touch `src/tasks/` — no file overlap.
- Fake-timer e2e tests can be flaky if `jest.useFakeTimers()` interferes with Nest's own
  bootstrap (e.g., internal `setTimeout` use); mitigate by only faking time after `app.init()`
  if that turns out to be the case.
