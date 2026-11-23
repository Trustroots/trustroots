# Notify native Nostranslation signers

## Why

A member needs to know about a time-limited Nostranslation request while Trustroots is closed.

## What Changes

- Offer device alerts after the first accepted pairing and allow members to disable them.
- Register the approved pairing and its destination through an authenticated mobile API.
- Observe the configured relay for valid, fresh NIP-46 envelopes and deduplicate by event ID across watcher restarts.
- Deliver a generic wake-up alert through UnifiedPush on Android and APNs on iOS. Review and approval still happen on the phone.

## Impact

- Specs: nostr-integration
- Code: mobile API, worker, native notification registration and routing
- Tracking: #3633
