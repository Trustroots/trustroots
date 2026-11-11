# Improve Nostr participation in Radio and Hackers

## Why

Members with a linked Nostr identity should be able to participate without a manual first connection, while local radio playback should be represented immediately. The Hackers circle also needs a distinct member-only Nostr chat.

## What Changes

- Detect a complete Nostr extension on Radio and Hackers entry for up to five seconds, then attempt the member's linked and NIP-05 verified identity once. Keep manual retry and ignore stale async completions.
- Count local Radio playback immediately for all visitors, deduplicating it against shared activity when the linked public key is known. Label the local contribution.
- Add Hackers member-only chat using kind-1 events tagged `trustroots-circle-hackers` on the existing Radio relays. Read and publish only for signed-in members; publishing requires the verified linked signer.
- Preserve existing Radiostr tags, event format, relay behavior, and sharing intervals.
