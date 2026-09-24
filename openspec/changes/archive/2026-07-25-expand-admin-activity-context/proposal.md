# Expand admin activity context

## Why

The administration dashboard shows message and thread-vote activity but does
not surface recent negative experiences. Acquisition stories also lack the
location context that can help administrators understand where signup activity
is coming from.

## What Changes

- Show the ten most recent experiences whose recommendation is negative on the
  administration dashboard.
- Identify both members and the date for each negative experience.
- Add member living and origin locations to acquisition-story rows when
  available.
- Add the most recently updated hosting-offer location as a fallback context,
  using the stored fuzzy location when available.

## Impact

- `modules/admin` dashboard and acquisition-story responses, components, and
  tests
- `modules/experiences` and `modules/offers` data queried by administration
  controllers
- administration end-to-end feature coverage
