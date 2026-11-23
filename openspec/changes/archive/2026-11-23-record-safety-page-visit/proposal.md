# Record safety page visits

## Why

Trustroots needs to know which signed-in members have opened the safety guidance so future onboarding work can distinguish members who have visited from those who have yet to visit.

## What Changes

- Record a private boolean on the current member's account when the browser displays `/safety`.
- Keep the record across sessions. Repeated visits have the same effect as a single visit.
- Keep the safety page public and usable if recording fails.

## Affected Modules and Compatibility

The web shell records the visit through the authenticated users API. The users module stores the flag on the account. Existing accounts without a flag are treated as having yet to visit, so no data migration is required.
