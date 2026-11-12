## Why

Administrators need to publish homepage updates directly from Trustroots using their Nostr browser signer.

## What Changes

- Add a public text note composer to the Nostr admin page.
- Publish a NIP-07-signed kind 1 note to the featured-note relays and feature it after acknowledgement.
- Allow retrying the homepage save with the same signed event.

## Capabilities

### Modified Capabilities

- `nostr-integration`: Administrators can publish and feature a note in one flow.

## Impact

The admin page uses the existing relay list and featured-notes API.
