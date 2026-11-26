## Why

Move the connected-client rows in the iOS Nostranslation signing sheet to Compose as part of #3232.

## What Changes

- Render each connected client's existing public-key prefix and revoke control in shared Compose.
- Keep Swift in charge of the connected-client section, row identity, signing and account-scoped revocation.
- Give each revoke control an accessibility label that includes the visible client prefix.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS Nostranslation sheet uses shared Compose to present each connected client.

## Impact

The iOS signing sheet and shared UI change. The Swift signer continues to own pairing, signing, revocation, connection links, QR scanning and account-scoped storage.
