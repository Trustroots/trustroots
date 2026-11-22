## Why

Author visibility and NIP-05 are public lookup services with different callers and request patterns. A burst of lookups on one service should leave capacity for the other.

## What Changes

- Give author visibility and NIP-05 separate per-client allowances.
- Return HTTP 429 with retry guidance when an allowance is exhausted and retain the applicable privacy and CORS headers.

## Impact

- Affected spec is `nostr-author-visibility`.
- Affected code is the core route registration and its server and Playwright tests.
