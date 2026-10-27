## Why

Radiostr is currently a standalone Nostroots example. Bringing it to the Radio
circle makes shared listening available alongside the Trustroots community.

## What Changes

- Add a native radio player, station catalogue, favourites and station links.
- Show recent shared listener counts publicly; show identities and chat only
  after Trustroots login. Circle membership is not required.
- Allow publishing only through a Nostr extension whose key matches the logged-in
  member's verified Trustroots NIP-05 identity. Automatically share listening
  activity after ten seconds of playback and every five minutes thereafter.
- Preserve the existing Radiostr event formats and relays; stop playback and
  release connections when leaving the circle.

## Capabilities

### New Capabilities

- `radio-circle`: Shared radio listening within the Radio circle.

## Impact

Changes the tribes client, media CSP and circle provisioning. Uses the existing
nostr-tools dependency and NIP-05 endpoint; no private keys are stored. Existing
Nostroots remains available; add a link there after the Trustroots deployment.
Local favourites are origin-specific; relay favourites remain interoperable.
