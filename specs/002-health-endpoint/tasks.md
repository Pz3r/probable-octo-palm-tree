# Tasks: Health endpoint

- [x] Write failing tests for all acceptance criteria (test-writer)
      Verified: `npm test -- health` fails (module/files don't exist yet).
- [x] Enable `resolveJsonModule` in `tsconfig.json`
      Verified: `npm run typecheck` still passes (no behaviour change yet, flag is additive).
- [x] Create `src/health/health.entity.ts` with the `HealthStatus` interface
      Verified: `npm run typecheck` passes.
- [x] Create `src/health/health.service.ts` (captures start time, computes uptime, reads version from package.json)
      Verified: `npm test -- health.service` passes (AC2, AC3).
- [x] Create `src/health/health.controller.ts` with `GET /health`
      Verified: covered by e2e test once wired up.
- [x] Create `src/health/health.module.ts` and register it in `src/app.module.ts`
      Verified: `npm test -- health` passes end-to-end (AC1, AC2, AC3, AC4).
- [x] Run `npm run check` and fix anything red
      Verified: `npm run check` exits 0.
- [x] Independent review (spec-reviewer)
      Verified: reviewer run completes; blockers/majors addressed.
