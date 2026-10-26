## Why

SparkPost unsubscribe events currently produce metrics without withdrawing the
member's newsletter consent. Issue #2734 asks us to honour those requests.

## What Changes

- Handle list and link unsubscribe events through the existing authenticated
  SparkPost webhook and set matching members' newsletter preference to false.
- Preserve all other email preferences. Ignore missing or invalid recipient
  addresses, unknown recipients and unrelated events.
- Acknowledge batches only after preference updates finish; return a retryable
  failure when persistence fails. Keep metrics failures non-blocking.
- Document the SparkPost event subscription required for deployment. No data
  migration or historical event import is included.

## Impact

- Affected modules: sparkpost and users, with an intentional module dependency
  so the webhook can update the User model.
- Affected specification: email-subscriptions.
- Add unit and HTTP/database integration coverage. A browser test is unsuitable
  for this provider-to-server callback; the authenticated HTTP test exercises
  the complete webhook and persisted preference.
