# Preserve unlinked Community Notes

## Why

Trustroots currently consumes validation-server copies of Community Notes.
Those copies record a decision made at one point in time, so a later suspension
or shadowban makes the validation decision stale and would otherwise require
the validation server to retract or replace an event. The author-visibility
filter also treats every Nostr key that is not
linked to an eligible public Trustroots account as hidden, which removes valid
Nostroots content from unlinked authors.

## What Changes

- Consume original kind `30397` Community Notes everywhere instead of kind
  `30398` validation-server copies, including map and profile queries.
- Distinguish author keys linked to Trustroots accounts from unknown keys.
- Continue hiding notes from known shadowbanned, suspended, or private members.
- Preserve notes from valid but unlinked Nostr authors.
- Continue rejecting malformed author keys and fail open on transient API
  failures for valid keys.

## Affected Modules

- `modules/core` (author-visibility response)
- `modules/search` (Community Note filtering and tests)
- `tests/e2e` (original-event map fixture)
