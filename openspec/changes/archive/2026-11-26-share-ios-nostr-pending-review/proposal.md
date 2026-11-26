## Why

Move the pending translation review card in the regular iOS Nostranslation signing sheet to Compose as part of #3232.

## What Changes

- Render the review destination, expiry warning and approve and deny controls with shared Compose.
- Use the iOS timeline to update the displayed expiry and bind the controls to the exact review.
- Keep authorisation, the current time check and the signer's resolution in the existing native path.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS Nostranslation sheet uses shared Compose to present a pending translation review.

## Impact

The iOS signing sheet and shared UI change. Swift continues to own the review, pairing, signing, account scope and relay interaction. Compose receives the displayed destination and an expiry flag.
