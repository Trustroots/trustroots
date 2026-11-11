## Why

Members naturally reply to message notification emails, but those replies do not
reach their conversation. Issue #715 requests email replies.

## What Changes

- Add opt-in inbound message replies through a dedicated JMAP mailbox.
- Give notifications a private, expiring reply address scoped to the notified
  member, their current email address and the other conversation participant.
- Accept plain-text replies, excluding quoted notification content and automated
  mail, and apply normal member eligibility and message delivery rules.
- Deduplicate mailbox deliveries and preserve retryability after failures.
- Keep existing notification behaviour when the feature is disabled.
- Add a read-only `/admin/email-replies` page for inspecting mailbox health,
  parsing and conversation matching during testing, and delivery outcomes after
  activation. Existing replies without tokens must remain visibly distinct from
  verified matches.

## Impact

Affected areas: messages, admin, shell routes, core email templates, worker
scheduling and configuration.
Deployment requires a dedicated Stalwart mailbox supporting plus-addressing and a
dedicated signing secret. The feature defaults to disabled. Existing messages
require no migration; new inbound delivery metadata requires an index.

## Draft scope

This draft implements transport and reply-text validation primitives only. It
does not advertise reply addresses, schedule polling or create member messages.
Token issuance, retry-safe persistence, notification integration, admin
diagnostics and end-to-end coverage remain follow-up tasks within this proposal.
The admin page is specified here but is not implemented by the draft helpers.
The issue stays open.
