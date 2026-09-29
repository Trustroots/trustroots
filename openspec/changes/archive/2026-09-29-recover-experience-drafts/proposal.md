## Why

Pressing Finish does not protect an unsaved experience from a phone losing power.
Members also need to distinguish saving, saved-but-private feedback and a pending
private report.

## What Changes

- Save experience drafts locally for seven days, scoped to author and recipient,
  and offer restoration or discarding when the form is reopened.
- Show explicit Save experience, Saving and saved confirmation states.
- Read back an uncertain save before asking the member to retry.
- Confirm the experience immediately and send the optional private report separately.
- Show the configured feedback character limit and block oversized submissions.

## Capabilities

### Modified Capabilities

- `experiences-references`: Recover drafts and communicate submission outcomes.

## Impact

Experience client components, local browser storage, exposed feedback limit and
anonymous client/browser regression coverage. No database migration. Private
moderator report text stays in memory and is not persisted on the device.
