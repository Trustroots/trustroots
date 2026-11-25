## Why

The regular iOS inbox uses Compose, and the pilot already renders conversations in Compose. Sharing the conversation history advances the migration while retaining the regular app's iOS keyboard, navigation and messaging behaviour.

## What Changes

- Extract the pilot's message history and reuse it in the regular iOS conversation.
- Open at the newest message and return to it after sending or focusing the reply field.
- Show a failed reply's error beside the reply field and keep the text available for retry.
- Continue using the existing iOS reply field, profile navigation, experience actions, and authenticated conversation and read-state APIs.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS conversation displays message history in shared Compose.

## Impact

The shared Kotlin UI and iOS app change. Android's default conversation is unaffected. No API, persisted data or deployment changes are required.
