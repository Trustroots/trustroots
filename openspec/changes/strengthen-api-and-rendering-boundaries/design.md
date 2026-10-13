## Approach

Plain-text excerpts use React text children. Existing rich-text rendering sites
remain explicitly reviewed in the lint configuration; new direct HTML sinks
require an intentional configuration change. The existing lint job enforces this
boundary, including for pull requests from forks through a separate read-only job.

API middleware walks parsed body and query objects iteratively and rejects
reserved object keys. It leaves string values untouched, including rich text and
serialised application data. Endpoint validation additionally checks primitive
types and identifier formats before constructing database selectors.

The message-read POST updates message state and acknowledges a thread only when
its latest message is among the acknowledged identifiers. Conversation GET
requests only retrieve messages.

## Verification

Client regressions cover literal encoded content, server regressions cover input
shapes and read-state transitions, and browser tests verify member workflows.
Fast boundary checks run in CI without requiring a database. Existing complete
coverage and end-to-end suites retain their thresholds and scenarios.
