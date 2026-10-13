## Why

API input, text presentation and conversation read-state changes need consistent
boundaries that remain enforced as the application evolves.

## What Changes

- Render plain-text previews as text and retain rich formatting for full content.
- Validate message identifiers and staff username lookups at runtime.
- Reject reserved query keys in API request objects before route handlers.
- Keep conversation GET requests read-only and synchronise read state through the
  existing POST endpoint.
- Enforce reviewed HTML rendering boundaries through lint and CI regression tests.

## Impact

Affected modules: core, messages, users, administration and developer tooling.
No database migration is required. Clients must use the existing message-read
POST endpoint to acknowledge messages; fetching a conversation alone will no
longer acknowledge it. Reserved object keys are rejected with HTTP 400. Normal
member workflows and existing coverage thresholds remain unchanged.
