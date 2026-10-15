## Summary
Adds a `GET /health` endpoint for deployment/load-balancer liveness checks, as a new
`HealthModule` under `src/health/`. `HealthService` tracks uptime from the moment it's
constructed (`Date.now()`-based, no wall-clock dependency in unit tests) and reports the
app's version straight from `package.json` via a typed import. No new dependencies, no
changes to `src/tasks/`.

## Acceptance criteria
| AC | Test name | File |
|---|---|---|
| AC1: `GET /health` returns 200 with `status: "ok"` | `AC1: returns status "ok"` / `AC1: GET /health returns 200 with status "ok"` | `src/health/health.service.spec.ts`, `test/health.e2e-spec.ts` |
| AC2: `uptimeSeconds` is a non-negative integer that increases over time | `AC2: uptimeSeconds is a non-negative integer that increases over time` | `src/health/health.service.spec.ts` (fake timers), `test/health.e2e-spec.ts` (real sleep) |
| AC3: `version` equals `package.json`'s `version` | `AC3: version equals the version field in package.json` | `src/health/health.service.spec.ts`, `test/health.e2e-spec.ts` |
| AC4: response contains no other fields | `AC4: response contains exactly status, uptimeSeconds and version` | `src/health/health.service.spec.ts`, `test/health.e2e-spec.ts` |

## Review
spec-reviewer verdict: **PASS**, no blockers or majors. Two minors noted, left as-is:
- The e2e AC2 test uses a real 1.1s sleep instead of fake timers (the unit test already
  covers AC2 with `jest.useFakeTimers()`, satisfying the spec's own suggestion at that
  layer). The e2e sleep is slow but reliable and not currently a practical problem (full
  suite still runs in ~3s).
- No test for unsupported methods/paths (e.g. `POST /health`) — not required by any
  acceptance criterion, so left uncovered.

## Notes for the reviewer
- One file outside the plan's `src/health/` boundary: `tsconfig.json` gained
  `"resolveJsonModule": true`, needed to statically import `version` from `package.json`
  in `health.service.ts`. It's additive and compiler-only; `npm run check` confirms no
  regressions elsewhere.
- No new npm dependencies were added (per the spec's constraint, `@nestjs/terminus` was
  deliberately avoided — see `plan.md`'s rejected alternatives).
- `src/tasks/` was not touched.
