## Why

Administrators featuring announcements from their own Nostr accounts need a way to request that relays delete a previously published note.

## What Changes

- Let an administrator sign and publish a NIP-09 deletion request for a featured kind 1 note.
- Remove the homepage copy after at least one relay acknowledges the request.
- Keep local removal available independently of Nostr publication.

## Capabilities

### Modified Capabilities

- `nostr-integration`: Request deletion of an administrator-curated Nostr note.

## Impact

The deletion flow uses the author's browser signer and the existing relay set. Trustroots stores the deletion event ID and discards the featured copy so a surviving relay cannot cause it to be featured again.
