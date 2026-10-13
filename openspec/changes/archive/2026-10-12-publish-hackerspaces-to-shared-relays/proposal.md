# Publish hackerspace places to shared relays

## Why

Place events should be discoverable through the Trustroots and Nomadwiki relays.

## What changes

- Publish each administrator-approved, NIP-07-signed place event to both fixed relay URLs.
- Show separate per-relay publication results and continue if one relay is unavailable.
- Close publication connections after an import without disturbing public map subscriptions.
- Add the fixed Nomadwiki relay URL to the browser connection policy.

## Impact

The public map continues reading the Trustroots relay. No signing keys or database migrations are introduced.
