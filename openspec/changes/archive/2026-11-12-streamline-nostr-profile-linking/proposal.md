## Why

Linking a Nostr key currently requires members to supply their npub before choosing a signer. A connected signer can supply the public key and sign the verification challenge itself.

## What Changes

- Detect NIP-07 and offer a single action to link the browser signer's key.
- Offer NIP-46 pairing by QR code or by opening a compatible signer app when NIP-07 is unavailable.
- Keep manual key entry and existing signing methods available.

## Impact

The profile networks editor will obtain the npub and proof from the selected signer and submit them through the existing profile API.
