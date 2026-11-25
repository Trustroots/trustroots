## Why

Saving a Nostr key creates a Trustroots NIP-05 lookup, but Nostr clients also
need a kind 0 metadata event signed by the member to discover that address.

## What Changes

- Publish the member's NIP-05 address after linking a key with a connected
  signer and confirming the public lookup.
- Preserve existing Nostr metadata and report publication failures independently
  of the profile save.
- Let members publish or retry for an already linked key using a connected signer.

## Capabilities

### Modified Capabilities

- `nostr-integration`: publish member-signed kind 0 metadata from network settings.

## Impact

Changes the users network settings and reuses the Trustroots authenticated relay
connection. No database migration or deployment setting is required.
