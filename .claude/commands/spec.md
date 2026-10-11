---
description: Draft a new spec from a feature idea (no code)
argument-hint: <feature description>
---

Draft a spec for: $ARGUMENTS

1. Look at `specs/` to pick the next number (NNN) and a short kebab-case slug.
2. Read the relevant code so the spec matches what exists (names, routes, modules).
3. Create `specs/NNN-slug/spec.md` from `specs/_template.md` with `status: draft`.
4. Write acceptance criteria as numbered, testable statements (AC1, AC2…): concrete inputs,
   status codes and outputs. No vague words like "properly" or "handle".
5. Fill "Out of scope" generously — it's what stops agents from over-building.
6. Put anything you had to guess under "Open questions". Do not resolve them yourself.

Do NOT write any code or tests. Finish by listing the open questions for me to answer.
When I'm happy, I'll change the status to `approved` myself.
