## Why

The regular iOS conversation shares message history with the pilot. Reusing the
reply composer completes the migration of the conversation body and makes the
pilot's protected draft storage available in the regular app.

## What Changes

- Use the shared Compose reply composer in the regular iOS conversation.
- Preserve the existing read-state, profile and experience actions.
- Restore an unsent reply when its conversation reopens. Keep drafts scoped to
  the current server, account and recipient, and clear them after delivery or
  when the member deletes the text.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS conversation shares history and replies.

## Impact

The shared Compose UI and regular iOS conversation change. The same local draft
store serves the pilot and regular app. No API or deployment changes are required.
