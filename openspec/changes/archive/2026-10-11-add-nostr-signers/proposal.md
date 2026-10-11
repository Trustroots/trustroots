# Nostr signer connections for profile key linking

## Why

Members can sign the profile ownership challenge with a browser extension, a NIP-46 signer or an external tool. Android signers should be able to handle the same challenge directly from the profile editor.

## What Changes

- Support NIP-46 bunker links and generated Nostr Connect pairing links with QR codes.
- Support NIP-55 Android signer callbacks and explicit clipboard fallback.
- Use the existing server ownership challenge when saving a new or replacement key through NIP-07, NIP-46 or NIP-55.
- Allow secure WebSocket relay destinations in CSP for remote signer compatibility.

## Impact

This affects the profile networks editor, its signer adapters and end-to-end tests. The existing profile save enforces ownership proof and key uniqueness for new and replacement keys.
