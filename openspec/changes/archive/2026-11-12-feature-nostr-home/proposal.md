## Why

Trustroots announcements can be published from an existing Nostr identity. Administrators need a way to select which public notes appear on Trustroots.

## What Changes

- Add an administrator page for featuring and removing published Nostr text notes.
- Show featured notes on the public homepage with attribution and a link to the original.

## Capabilities

### Modified Capabilities

- `nostr-integration`: Administrators can curate public kind 1 notes for the homepage.

## Impact

The admin page reads notes from known public relays. Trustroots verifies and stores featured notes so the homepage can render without relay connections. Administrators sign and publish through their usual Nostr client.
