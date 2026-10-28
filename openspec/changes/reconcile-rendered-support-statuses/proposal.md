## Why

Historical support emails escaped HTML characters or expanded bare URLs before
Zendesk stored them. Exact hashes of the original stored requests therefore miss
otherwise identical tickets, leaving their historical statuses unimported.

## What Changes

- Compare reduced manifests against the original request and the documented
  historical email-rendering forms of its original email address and message.
- Require a unique request and a unique source ticket across all rendering forms.
- Recheck the same identity and concurrent-activity safeguards during apply.
- Explain rendering collisions in the existing import preview and document how
  to preview an existing manifest again.
- Move member search from the inbox to its own support-accessible sidebar page,
  and link the original sender beside the request timestamp.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Conservative import recognises historical email rendering
  while preserving one-to-one matching, review and idempotency.

## Impact

Support import matching, administrator navigation, sender headers, skip-reason
text and fictional regression tests. The manifest format remains version 1. No new dependencies, automatic
closures, real correspondence, exports or diagnostics are included.
