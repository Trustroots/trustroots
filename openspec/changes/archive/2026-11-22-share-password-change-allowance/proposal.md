## Why

The browser and mobile APIs validate current passwords through the same account operation. Both clients should share the same allowance, with room for typing mistakes and retries.

## What Changes

- Give authenticated password changes a common per-member allowance across browser and mobile sessions.
- Return HTTP 429 with `Retry-After` before checking or changing the password once the allowance is exhausted.

## Impact

- Updates `account-access` and the password-change route registrations.
- Reuses the existing request allowance middleware and store. The mobile module uses the core middleware directly.
