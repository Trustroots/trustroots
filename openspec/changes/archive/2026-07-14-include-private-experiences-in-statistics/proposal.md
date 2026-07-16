## Why

Private Experiences represent real interactions that have already happened.
Excluding them makes aggregate community statistics understate the number of
experiences, recommendations, and real-life connections.

## What Changes

- Include private and public Experiences in the aggregate statistics shown to
  visitors.
- Keep the response strictly aggregate: it does not expose any Experience
  text, identity, visibility status, or individual record.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `experiences-references`: include private Experiences in anonymous public
  aggregate statistics.

## Impact

- `modules/statistics` aggregation and its server and client-facing API tests.
- No migration, dependency, or individual Experience access change is
  required.
