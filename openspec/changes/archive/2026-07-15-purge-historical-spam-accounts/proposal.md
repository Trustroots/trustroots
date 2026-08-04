## Why

The database retains two identified historical automated-signup waves: over
400,000 non-public suspended records created across five days in July 2021 and
February 2023. They have no useful community activity, yet they make the
moderation view overwhelmingly list bots and needlessly retain their data.

## What Changes

- Add a one-off maintenance command that targets only the two known bot-signup
  windows.
- Permanently remove only non-public suspended accounts in those windows that
  have no community activity, moderation record, or uploaded profile image.
- Make the command dry-run by default, report only aggregate counts, and
  require an explicit deletion switch.

## Capabilities

### New Capabilities

- `historical-spam-cleanup`: safely remove accounts from identified historical
  automated-signup campaigns.

### Modified Capabilities

- None.

## Impact

- `bin/db-maintenance` gains a dry-run maintenance command and its tests.
- Removing the historical bot records makes suspended-member views in the
  administration tool useful again.
- No worker scheduling, API, client change, dependency, schema change, or data
  migration is required.
