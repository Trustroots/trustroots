## Why

Email confirmation uses a cramped layout and cannot display addresses from current opaque confirmation links. Members need to see which address they are changing before confirming.

## What Changes

- Add a read-only, token-validated preview of the current and pending email addresses and signup status.
- Present confirmation in a responsive card with labelled addresses, explanatory text and clear loading, success and recovery states.
- Allow members to cancel pending email changes from account settings or a valid confirmation link, keeping their current address and invalidating the link.

## Capabilities

### Modified Capabilities

- `account-access`: Preview the email change before consuming a confirmation link.

## Impact

Users module API, confirmation page, styles and tests. Existing links and confirmation behaviour remain compatible. No data migration is required.
