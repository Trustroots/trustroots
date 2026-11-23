# Surface Experiences awaiting a reply

## Why

Members can reply to received Experiences, but the relevant cards are spread
across the pending list and the public list. A member reviewing their own
profile should be able to find both in one place. This is part of #3750.

## What changes

- Group received Experiences that have no reply on the signed-in member’s own
  Experiences page. Show pending cards first, with the existing countdown and
  reply action, followed by public cards with their existing reply action.
- Render each card once. Public summary totals include all public Experiences,
  including those awaiting a reply.
- Use the existing list payload and visibility rules.
