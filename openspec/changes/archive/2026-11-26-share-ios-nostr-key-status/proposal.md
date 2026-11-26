## Why

Move the public-key status presentation in regular iOS Account to shared Compose as part of #3232.

## What Changes

- Render the Nostr introduction and profile-linked and local-key status in Compose.
- Pass only availability flags to the shared UI. Use the existing native selectable key text and account-scoped identity.
- Preserve the iOS confirmations and operations for copying, linking, claiming, importing, backing up and removing keys.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the iOS Account Nostr section uses shared Compose for identity status.

## Impact

The iOS Nostr status presentation and shared UI change. No storage, signing, API or browser routing changes are required.
