## Why

Members can currently associate an npub without demonstrating control of its signing key (#2718).

## What Changes

- Require a fresh signed server challenge when adding or replacing a profile npub.
- Support NIP-07 browser signers, NIP-46 bunker signers and externally signed event JSON.
- Preserve existing associations and allow unchanged keys and removal without signing.
- Never request or transmit a member's private key, or publish ownership proofs to relays.

## Impact

Changes the users module, its API, profile networks editor and automated tests. Adds two private, optional challenge fields to user documents; no migration is required. Existing API clients must supply proof when changing a non-empty npub. NIP-46 connections use the relays in the member's bunker URI.
