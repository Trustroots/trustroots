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

## Deployment

The default configuration remains disabled. Operators provision a dedicated
mailbox with plus-address delivery, configure credentials and a signing secret,
then verify an actual notification/reply round trip before general activation.
Old notifications retain their existing behaviour. Disabling the feature stops
new reply addresses and inbound processing without deleting stored messages.
