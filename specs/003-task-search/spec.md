---
id: 003
title: Task search and pagination
status: draft
owner: sam
---

# Task search and pagination

## Problem
`GET /tasks` returns everything. With many tasks, clients need to search by title and page through results.

## Behaviour

```http
GET /tasks?q=ship&limit=20&offset=0
→ 200 { "items": [ … ], "total": 42, "limit": 20, "offset": 0 }
```

## Acceptance criteria
1. AC1: `q` matches tasks whose title contains the text, case-insensitively.
2. AC2: `limit` defaults to 20, must be 1–100; `offset` defaults to 0, must be ≥ 0. Out-of-range → 400.
3. AC3: `total` is the number of matches before pagination.
4. AC4: Results stay in creation order.

## Constraints
- Must compose with any other list filters that exist when this is implemented.

## Out of scope
- Full-text search, ranking, cursor-based pagination.

## Open questions
- Changing `GET /tasks` from an array to `{ items, total, … }` breaks existing clients and tests.
  Do we change it, version it (`/v2/tasks`), or add a separate `GET /tasks/search`?
- Should `q` also match accented/unaccented variants ("diseño" vs "diseno")?
- Should an empty `q=` be treated as "no filter" or rejected?
