## Why

Members need to see when a conversation was last active from the Android inbox.

## What Changes

- Show the last message time on inbox rows using the existing thread timestamp and message time formatting.
- Omit the time when the timestamp is unavailable or invalid.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: Android inbox rows show the time of the last message.

## Impact

- Android inbox parsing, presentation and tests. No API, migration or deployment changes.
