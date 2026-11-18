## Why

Administrators need to correct published Trustroots updates and insert links without remembering Markdown syntax.

## What Changes

- Add an insert-link action for composing and editing featured updates.
- Publish editable updates as NIP-23 addressable events and require the original author to sign later revisions.
- Give existing featured short notes an addressable version when first edited, retaining their original publication date and homepage position.
- Keep signed revisions and Nostr deletion requests retryable if the homepage write fails.

## Capabilities

### Modified Capabilities

- `nostr-integration`: Extend the existing featured note publication and moderation workflow.

## Impact

Changes the admin composer, the featured-notes API and the featured-note model. Existing kind 1 records remain readable and featureable.
