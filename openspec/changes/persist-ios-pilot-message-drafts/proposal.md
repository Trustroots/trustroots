# Persist iOS Compose pilot message drafts

## Why

The shared Android journey already saves replies locally. The iOS pilot keeps
them in memory, so leaving the pilot or restarting the app loses unsent text,
including after a failed send.

## What Changes

- Save iOS pilot drafts in protected local files, scoped to the server, account
  and conversation recipient.
- Restore unsent text when the same account reopens the conversation, including
  after relaunch or signing back in. Clear it on deletion or successful send.
- Cover storage isolation and the failed-send, relaunch and manual-retry flow.

## Impact

- Affected specs: shared-mobile-build
- Affected code: iOS Compose pilot host and its tests
