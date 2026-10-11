---
id: NNN
title: <Short feature name>
status: draft # draft → approved (set by a human, never by an agent)
owner: <you>
---

# <Short feature name>

## Problem
Why this matters, in 2–4 sentences. Who is affected and what they can't do today.

## Behaviour
What changes, from the API consumer's point of view. Include request/response examples.

```http
POST /example
{ "field": "value" }
→ 201 { "id": "…", "field": "value" }
```

## Acceptance criteria
Numbered, testable, concrete. Each one becomes at least one test named `AC<n>: …`.

1. AC1: Given …, when …, then … (status code + body shape)
2. AC2: …

## Constraints
Technical rules the implementation must follow (compatibility, performance, conventions).

## Out of scope
What NOT to build, even if it seems helpful. Agents over-build; this section stops them.

## Open questions
Anything uncertain. A spec with open questions can't be approved.
