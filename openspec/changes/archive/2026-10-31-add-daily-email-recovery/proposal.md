## Why

Administrators need to inspect actual provider messages per UTC day and recover selected sign-up confirmations and unread-message reminders after an interruption.

## What Changes

- Replace the capped event sample with cursor pagination over all available provider event types, grouped by provider message ID and recipient.
- Show subject, recipient, campaign, event history and current account matches. An account match does not prove linkage to a particular application message.
- List recovery candidates from application sign-ups and unread conversations per day, with checkboxes and select-all for the displayed page.
- Review selected recipients before queuing fresh confirmations or current unread reminders. Revalidate eligibility on submission, require live mail, persist per-candidate claims and outcomes to prevent duplicate submissions, and audit the actor and result.

## Impact

Admin UI/API, server recovery service, admin recovery record model, tests and living admin specification. Existing admin-to-user/message/core dependencies are reused. No automatic sends or raw replay of provider email content. New recovery collection uses unique candidate keys. Existing mail worker delivers queued emails.
