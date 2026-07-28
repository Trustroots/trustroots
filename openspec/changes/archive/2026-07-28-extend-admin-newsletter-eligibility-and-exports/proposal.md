# Extend admin newsletter eligibility and exports

## Why

The current newsletter CSV splitter only checks `public` and `newsletter`
flags, which can still include members who should not receive emails anymore
(for example suspended, shadowbanned, or deletion-pending accounts). Admins
also need first-class export tools for current recipients, both globally and
for a specific circle.

## What Changes

- Tighten newsletter eligibility to "generally safe to email":
  - `public: true`
  - `newsletter: true`
  - no restricted roles (`suspended`, `shadowban`)
  - not pending profile deletion
- Apply this eligibility check to CSV splitting so ineligible accounts are
  classified as unsubscribed.
- Re-enable/add admin newsletter export APIs:
  - export all eligible subscribers
  - export eligible subscribers for a specific circle
- Extend `/admin/newsletter` with dedicated export tools for both global and
  per-circle recipient lists.

## Affected Modules

- `modules/admin/server` (newsletter eligibility + export routes/controllers)
- `modules/admin/client` (newsletter export UI and API helpers)
- `modules/admin/tests` (server/client test coverage)
- `tests/e2e/features/admin-moderation` and `tests/e2e/feature-coverage.js`

## Compatibility and Deployment

- No schema migration required.
- Existing admin access controls remain unchanged.
- Export responses remain CSV so existing admin workflows can continue.
