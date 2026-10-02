## Why

Profile sanitisation removes known private fields from a full document, allowing new fields to become visible by default. Project responses onto explicit public and account-owner field lists after existing sanitisation.

## What Changes

- Explicit profile response fields.
- Add focused regression tests and preserve coverage requirements.

## Capabilities

### Modified Capabilities

- `account-access`: Explicit profile response fields.

## Impact

No database migration. Clients keep documented profile fields and derived membership and volunteer flags. Administrative IP and acquisition fields remain available through administrative APIs, not profile responses.
