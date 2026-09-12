# Add Nostr author visibility API

## Why

Community-note clients need to exclude notes from shadowbanned authors without
performing one relay and NIP-05 lookup per author. The existing NIP-05 lookup
only works in the username-to-public-key direction and cannot efficiently
check a set of note authors.

## What Changes

- Add a public batch API that accepts one or more Nostr public-key hex values.
- Return only keys associated with eligible public Trustroots members.
- Use the API when filtering community-note authors on the search map.

## Capabilities

### New Capabilities

- `nostr-author-visibility`: Determine which Nostr public keys may have their
  community notes displayed publicly.

### Modified Capabilities

- `nostr-integration`: Community-note discovery excludes notes from
  shadowbanned and otherwise non-public authors.

## Impact

- Adds a public read-only API route in the core module.
- Changes the Nostr client service and search-map note filtering.
- Adds server and client regression coverage.
