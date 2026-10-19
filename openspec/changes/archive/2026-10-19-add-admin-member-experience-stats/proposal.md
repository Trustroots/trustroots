# Add member experience statistics

## Why

The admin member page shows messages and thread votes but omits experiences,
and its mixed inline lists make activity difficult to compare.

## What Changes

- Add received and written experience totals, published positive, negative and
  neutral recommendation counts, and unpublished counts to the admin member API.
- Exclude removed experiences from these statistics.
- Present member activity in responsive, consistently labelled cards and show
  account status separately from the existing current-role badges.

## Affected Modules

- `modules/admin`: member response, statistics presentation, server/client tests.
- `tests/e2e`: administrator member inspection.

The API change is additive, uses existing admin authorisation and the existing
admin-to-experiences dependency, and needs no migration or deployment ordering.
