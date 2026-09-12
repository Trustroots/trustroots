## Why

Members must currently download profile, contacts, and hosting offers as three
separate files. A single portable export makes it easier to retain their data.

## What Changes

- Add an unsigned, versioned JSON export for the authenticated member's
  profile, contacts, and hosting offers.
- Deliver it as a JSON attachment from `GET /api/users/export`.
- Add a Download all data link above the existing individual downloads.

## Capabilities

### Modified Capabilities

- `account-access`: Members can download their supported data in one versioned
  JSON file.

## Impact

- Adds one authenticated API route and a link in account settings.
- Reuses the existing data sanitisation and access rules.
- Does not add signing, hashes, manifests, keys, or infrastructure.
