---
id: 001
title: Task priority
status: approved
owner: sam
---

# Task priority

## Problem
All tasks look equally important. Clients want to mark tasks as low, medium or high priority
and fetch only the ones that matter right now.

## Behaviour
Tasks gain a `priority` field: `"low" | "medium" | "high"`, default `"medium"`.

```http
POST /tasks
{ "title": "Ship v1", "priority": "high" }
→ 201 { "id": "…", "title": "Ship v1", "done": false, "priority": "high", … }

GET /tasks?priority=high
→ 200 [ …only high-priority tasks, in creation order… ]
```

## Acceptance criteria
1. AC1: Creating a task without `priority` returns it with `priority: "medium"`.
2. AC2: Creating a task with `priority` set to `low`, `medium` or `high` stores and returns that value.
3. AC3: Creating or updating with any other `priority` value (e.g. `"urgent"`, `1`) returns 400.
4. AC4: `PATCH /tasks/:id` with `{ "priority": "low" }` changes only the priority (and `updatedAt`).
5. AC5: `GET /tasks?priority=high` returns only high-priority tasks, still in creation order.
6. AC6: `GET /tasks?priority=bogus` returns 400.
7. AC7: `GET /tasks` without the param still returns all tasks (no behaviour change).

## Constraints
- Use a TypeScript enum `TaskPriority` and `@IsEnum` validation.
- Filtering happens in the repository/service, not the controller.

## Out of scope
- Sorting by priority.
- Filtering by multiple priorities at once.
- Any change to `done` semantics.

## Open questions
None.
