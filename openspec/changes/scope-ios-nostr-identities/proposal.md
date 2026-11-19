# Account-scoped iOS Nostr identities

## Why

Issue #3633 requires keys to belong to a server and member, and signing to stop
on sign-out. The existing iOS identity is installation-wide. In the context of
#3232, lifecycle decisions should be shared Kotlin rather than a second native
policy that Android must later copy.

## What changes

- Add shared, secret-free account scope and signing-session policy in `apps/shared`.
- Use it in the existing iOS identity adapter with per-account Keychain entries.
- Preserve the legacy installation key until the member explicitly claims it;
  adopt it automatically only after a live profile reports the matching npub.
- Show local and linked public keys separately, offer public-key copy and
  device-authenticated private-key backup, and confirm local removal.
- Pause signing before sign-out requests and on session invalidation; retain keys.

## Boundaries

This is the first reviewable slice of #3633, not completion of either milestone.
Android key storage/UI/bridge, native profile linking, NIP-46 pairing, push alerts
and physical-device Radio/translation verification remain follow-up work.
Keychain and LocalAuthentication stay native adapters as required by #3232.
The SwiftUI screen remains the baseline; this does not migrate Account to Compose.
There are no server routes, deployment configuration or credential migrations.
The legacy key is copied to its claimed scope before its old entry is deleted.
