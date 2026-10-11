---
id: 002
title: Health endpoint
status: approved
owner: sam
---

# Health endpoint

## Problem
Deployments (Vercel/AWS load balancers) need a cheap endpoint to check the API is up.

## Behaviour

```http
GET /health
→ 200 { "status": "ok", "uptimeSeconds": 12, "version": "1.0.0" }
```

## Acceptance criteria
1. AC1: `GET /health` returns 200 with `status: "ok"`.
2. AC2: `uptimeSeconds` is a non-negative integer that increases over time (test with fake timers or an injected clock).
3. AC3: `version` equals the `version` field in package.json.
4. AC4: The response contains no other fields.

## Constraints
- New `HealthModule` in `src/health/`; do not modify `src/tasks/`.
- No new npm dependencies (don't add @nestjs/terminus).

## Out of scope
- Readiness vs liveness split, dependency checks, auth.

## Open questions
None.
