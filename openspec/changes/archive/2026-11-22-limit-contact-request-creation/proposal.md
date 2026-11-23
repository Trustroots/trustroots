## Why

Creating a contact request can send a notification to another member. A per-member allowance leaves room for ordinary use while bounding repeated requests.

## What Changes

- Give each authorised member an hourly allowance for creating contact requests.
- Return HTTP 429 with `Retry-After` when a member reaches the allowance.

## Impact

- Updates `relationships-safety` and the contact creation route.
- Reuses the existing account-based request allowance store.
