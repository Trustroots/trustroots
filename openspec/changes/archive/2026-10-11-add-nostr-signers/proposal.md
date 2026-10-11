# Nostr signer connections and optional ownership verification

## Why

Members currently enter a Nostr public key manually or accept a browser extension suggestion. Remote and Android signers should offer the same convenience and optionally prove ownership of the saved key.

## What Changes

- Support NIP-46 bunker links and generated Nostr Connect pairing links with QR codes.
- Support NIP-55 Android signer callbacks and explicit clipboard fallback.
- Support optional ownership verification after saving, through NIP-07, NIP-46 or NIP-55.
- Bind a fresh signed server challenge to the member and saved key, consume it atomically and expose verification only in the member's editor.
- Allow secure WebSocket relay destinations in CSP for remote signer compatibility.

## Impact

Affected modules: users client/server, core CSP and rate limits, shared own-profile types, and end-to-end tests. Manual linking, public profiles, NIP-05 and key uniqueness remain unchanged. Existing keys default to unverified; additive private fields require no backfill. No Nostr login, persistent signer session or event publication is introduced.
