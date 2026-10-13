## Why

The Hitchhikers circle can help travellers discover recently reported hitchhiking locations using Hitchwiki's existing Nostr feed.

## What Changes

- Show a prominent public map of ride origins from the previous seven days on `/circles/hitchhikers`.
- Read kind 36820 rides and author-signed deletions from Hitchwiki's relay. Use recorded origin times, falling back to submission time when unknown; never treat an event update as a new ride.
- Share map rendering, safe popups, subscription lifecycle and styling with the hackerspace map from PR #3097.
- Keep source links, date meaning, approximate coordinates and database attribution visible.

## Impact

Client-only addition to tribes; no migration or signing needed. Browsers connect to the public Hitchwiki relay. This branch stacks on `codex/hackerspaces-place-map`.
