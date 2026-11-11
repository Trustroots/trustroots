# Email replies: JMAP implementation draft

This draft supports work on [issue #715](https://github.com/Trustroots/trustroots/issues/715).
It is not an enabled feature. No polling job, notification header or member
message write is connected to these helpers.

## Mail service

Trustroots will read a dedicated Stalwart mailbox using JMAP over HTTPS.
Bulwark is a separate webmail client; it is not an intermediary for this worker.
Existing outgoing SMTP delivery and support-inbox IMAP polling are unchanged.

The draft uses the authenticated JMAP session resource, its same-origin API URL,
`Email/query`, `Email/get` and `Email/set`. A mailbox-specific credential must
have access only to the reply mailbox. Configure the final HTTPS session URL
directly; the reader does not follow redirects with credentials.

References: [Stalwart JMAP](https://stalw.art/docs/http/jmap/) and
[JMAP for Mail, RFC 8621](https://jmap.io/spec/rfc8621/).

## Intended processing order

1. Read a bounded batch from the configured reply mailbox, excluding the custom
   `trustrootsProcessed` keyword.
2. Resolve the private reply address to its member and conversation. Verify its
   expiry and that the member's current email still matches the address binding.
3. Validate the incoming sender, recipient, automation headers and plain text.
   The draft parser recognises only explicit quote boundaries; it is not a
   general-purpose email signature or multilingual quotation parser.
4. Apply current messaging eligibility, blocking, formatting and throttle rules.
5. Persist the message and finish its conversation updates using a durable,
   unique inbound delivery key. A retry must resume unfinished updates without
   inserting another message. Scope the JMAP email ID to the configured server
   and account; a provider keyword alone is not a deduplication mechanism.
6. Only after processing completes, set `trustrootsProcessed`, preserving other
   mailbox keywords. A failed acknowledgement must be safe to retry.

Invalid emails need an explicit terminal outcome so they cannot keep occupying
the first batch forever. Transient provider or database failures must remain
retryable. Neither message bodies nor reply credentials should enter logs.

## Work needed before activation

- Private reply-address issuance, storage, expiry and revocation.
- Durable deduplication, crash recovery and concurrent-worker coordination.
- Shared message delivery integration, including moderation and statistics.
- Poll scheduling, credentials/configuration validation and operator diagnostics.
- Notification `Reply-To` and text/HTML instructions with the reply marker.
- Terminal rejection handling and a policy for attachment-only or HTML-only mail.
- Full server coverage and an end-to-end notification/reply/conversation test.
- A real Stalwart round trip, including alias delivery and provider retry tests.

## Planned administration page

`/admin/email-replies` will provide a read-only view for testing with existing
replies and for ongoing operations. It is part of the proposal, not an available
route in this draft.

| View               | Information                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| Mailbox health     | Configuration/mode, last poll, last success and sanitised errors           |
| Reply list         | Received time, sender, matching result, processing status and reason       |
| Reply detail       | Escaped source text, extracted reply, quote boundary and matching evidence |
| Processing history | Retained delivery, duplicate, rejection and failure outcomes               |

Inspection must not import messages, acknowledge mail or change mailbox read
flags. Legacy replies without conversation tokens need explicit uncertain or
unmatched states. Credentials and reply tokens must be redacted, and email HTML
and external resources must not render. Retry, manual delivery and deletion are
outside the initial read-only page.

The OpenSpec proposal remains active until this complete flow is implemented.
