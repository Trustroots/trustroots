# Improve admin acquisition stories

## Why

The acquisition-stories table provides the submitted text and basic member
identity, but administrators cannot quickly recognise the member, open their
public profile, compare circle participation, or reorder the rows while
reviewing the data.

## What Changes

- Show each member's profile picture linked to their public profile.
- Keep the existing administration report link for the member name.
- Include the number of circles each member has joined.
- Let administrators sort the table by date, member, circle count, or story.

## Affected Modules

- `modules/admin` (acquisition-story response, table, styles, and tests)
- `tests/e2e` (administration acquisition-story flow)
