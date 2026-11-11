## Decisions

Use Stalwart JMAP over HTTPS with a dedicated mailbox. Bulwark remains the
webmail client; Trustroots connects directly to Stalwart. Do not
mix member messages with support requests. Reply addresses are bearer credentials
and must never appear in logs. Validate both the address token and the current
sender email before accepting a reply. Tokens expire and secret rotation revokes
outstanding addresses.

The inbound path must reuse message eligibility, formatting, throttling, thread
updates and statistics. It must reject automated messages, attachments without
text, oversized messages, ambiguous senders and empty replies. Recognisable
quoted notification content is removed before saving. No attachment is imported.

Mailbox delivery identity must survive retries without creating a second message.
Do not acknowledge mail before its persistent message and conversation updates
complete. Configure TLS certificate verification and bound downloaded message
size and each polling batch. Keep web replies available in every notification.

Persist a bounded operational receipt for each considered delivery, including
its stable provider identity, receipt time, processing outcome, a safe reason
code, and enough sanitised matching evidence to diagnose sender and recipient
resolution. Retain only the extracted plain-text reply needed for diagnosis;
do not retain the full source message or quoted notification content. This
record is separate from the conversation message and must survive provider
acknowledgement. Define its retention period and cleanup behaviour before
enabling polling in production. Do not retain mailbox credentials,
reply-address tokens, or raw authentication-bearing headers in the record or
logs.

Expose the operational view at `/admin/email-replies` with a read-only API
guarded by the server-side admin policy on every request. Show mailbox
configuration state and the last connection and polling health, then a
paginated, filterable receipt table with processing outcomes of delivered,
rejected, failed, or duplicate, and separate matching results of verified,
candidate, ambiguous, or unmatched. A receipt detail view shows the extracted
reply, sanitised sender and recipient, and matching evidence. For comparison
during diagnosis, fetch the source text on demand from the provider and show a
redacted, escaped preview with the recognised quote boundary. Do not duplicate
the full source in receipt storage; if it is no longer available, say so without
losing the retained outcome. Include legacy reply
headers as evidence only after allowlisting and redacting secret-bearing parts;
never render raw HTML. Escape all message-derived text as plain text.

Dry-run polling may evaluate and record diagnostics, but must not create or
change conversation messages and must not acknowledge provider messages. Make
candidate, ambiguous, and unmatched results visible as such instead of
presenting a best-guess sender as confirmed. The page has no replay,
acknowledge, or delete controls; those operations need a separately designed
and reviewed workflow.

The diagnostic record and page are planned operational requirements before
general rollout. They are outside the current helpers-only draft implementation.

## Deployment

The default configuration remains disabled. Operators provision a dedicated
mailbox with plus-address delivery, configure credentials and a signing secret,
then verify an actual notification/reply round trip before general activation.
Before enabling polling outside testing, provision the admin-only diagnostic
view and choose a bounded retention period for operational receipts. Old
notifications retain their existing behaviour. Disabling the feature stops new
reply addresses and inbound processing without deleting stored messages or
receipt records before their retention period expires.
