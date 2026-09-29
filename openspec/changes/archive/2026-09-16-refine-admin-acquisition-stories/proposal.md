# Refine admin acquisition stories

## Why

Signup stories commonly contain the same phrases, so using them to match an
acquisition-story row to restricted accounts produces misleading leads. The
table also does not show whether a member completed signup by making their
profile visible, and its compact headings lack explanatory context.

## What Changes

- Limit restricted-account matches in the acquisition-stories view to
  normalised username and email local-part identifiers.
- Show whether each member's profile is visible and allow that column to be
  sorted.
- Add accessible explanations to the table's compact column headings.
- Keep acquisition-story matching in individual restricted-member reports.

## Impact

- Affects the acquisition-stories administrator API, React view, and tests.
- Adds a boolean field to an internal administrator response and narrows the
  match reasons returned by that response.
- Requires no data migration or deployment coordination.
