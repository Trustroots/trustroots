# Show restricted-account matches in acquisition stories

## Why

The acquisition-stories view gives administrators useful signup context but
does not highlight when a current story or account identifier resembles a
suspended or shadowbanned account. Administrators must currently repeat this
comparison manually.

## What Changes

- Compare acquisition-story rows with a bounded set of suspended and
  shadowbanned accounts.
- Match normalised username and email local-part identifiers, exact normalised
  acquisition stories, and conservatively similar acquisition stories.
- Show links to matching restricted member reports and label the signal that
  produced each lead.
- Keep matches informational only and make no automatic moderation changes.

## Impact

- Affects the acquisition-stories administrator API and React view.
- Uses bounded in-memory comparison after the existing bounded story query; no
  data migration or public API change is required.
- Adds server, client, and end-to-end coverage.
