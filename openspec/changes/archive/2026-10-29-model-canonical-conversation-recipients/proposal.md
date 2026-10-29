## Why

The authenticated mini-user lookup already rejects a missing or blank member ID,
but returns the same nullable-ID DTO used by sparse inbox and host records.
Conversation state and views therefore repeat checks for a result the lookup
cannot produce. A dedicated recipient type makes the existing contract explicit.

## What Changes

- Return a conversation recipient with a non-null canonical ID from the lookup.
- Carry that type through conversation state, draft keys, sending and artwork.
- Share member-label formatting without changing sparse generic member records.
- Preserve malformed-response rejection, optional usernames and route identity.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: document the existing canonical recipient contract.

## Impact

Internal Android data contracts and their consumers. No HTTP payload, persisted
draft key, navigation key or user-visible behaviour changes. Existing JVM and
device conversation journeys validate the refactor; no new end-to-end behaviour
is introduced.
