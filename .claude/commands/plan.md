---
description: Turn an approved spec into plan.md + tasks.md (no code)
argument-hint: <specs/NNN-slug>
---

Plan the implementation of $ARGUMENTS.

1. Read `$ARGUMENTS/spec.md`. If its status is not `approved`, stop and tell me.
   If it has unresolved open questions, stop and list them.
2. Explore the code it touches. Use the `nestjs-conventions` skill.
3. Write `$ARGUMENTS/plan.md`:
   - Approach (a few paragraphs), and alternatives you rejected with one line each
   - Files to create / modify
   - Data and API shape changes
   - Risks, and which other specs in `specs/` could conflict (same files)
4. Write `$ARGUMENTS/tasks.md`: a checkbox list of small tasks, each ending with how it's verified.
   The first task is always "Write failing tests for all acceptance criteria (test-writer)".
   The last is always "Independent review (spec-reviewer)".

Do NOT write code. Summarise the plan in under 10 lines and wait for my go-ahead.
