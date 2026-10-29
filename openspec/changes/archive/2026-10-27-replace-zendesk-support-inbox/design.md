# Shared support inbox design

## Inbox and correspondence

The original SupportRequest remains the source of the initial message; it is
not copied into SupportMessage. Conversation responses synthesise that first
entry and paginate subsequent messages. Request URLs use
`/admin/support/requests/<id>` with search, category, status and page parameters.
The list API normalises legacy statuses and categories before searching and
counting. Status facets ignore the selected status but retain other filters.

SupportMessage stores plain text, staff attribution, threading identifiers,
attachment metadata and delivery state. It holds all submission and retry keys
under a unique per-request index. Agenda jobs contain only message IDs. An
atomic queued-to-sending claim prevents duplicate jobs from sending twice;
interrupted sends become uncertain and require explicit retry. Recovery finds
durable queued records even when scheduling was interrupted and reconciles
accepted messages whose request activity update was interrupted, without
resending them. SMTP acceptance is
distinct from final delivery; local JSON transport records captured mail and
does not move a request to Pending.

Status revisions protect manual changes and newer activity from an older
outbound completion. Incoming replies store an activity-application marker so
an interrupted write can be repaired on replay without reopening a request
again after a later staff decision. Known delivery-status failures update the
outbound record and reopen an untouched Pending request. Sender matching uses
the original recorded email and known Message-ID references; a subject is never
used to attach correspondence or grant member investigation access.

## Mail intake and rollout

The opt-in ImapFlow worker uses verified TLS and a read-only mailbox lock. It
streams MIME through MailParser, converts HTML to plain text, discards file
streams and retains attachment metadata. Raw processing is bounded to 25 MiB;
stored text is bounded to 12 MiB to fit MongoDB documents. Omitted content is
labelled and remains in Zoho. Automatic responses do not create reply loops.

The first poll establishes a cutover at the existing mailbox end. Durable UID
and UIDVALIDITY checkpoints advance only after processing; Message-ID/inbound
keys deduplicate replay. A UIDVALIDITY reset rescans a bounded UID range against
the original cutover, while ordinary fresh UIDs are processed regardless of an
older INTERNALDATE. Agenda lock renewal protects long polls. Existing mailbox
history and historical Zendesk reply routing require an operator's cutover
review rather than automatic attachment to current requests.

Website submissions are persisted before their acknowledgement is queued. With
the inbox enabled they no longer forward a second copy into the monitored
mailbox. Deployment mail policy captures mail and disables IMAP by default;
controlled staging round trips use a separate mailbox and recipient allowlist.
Live production requires the explicit production tier and domain. Credentials
remain deployment secrets, and request logs redact support query parameters.

## Reduced manifest

The local preparation command reads one or more Zendesk JSON export pages or
NDJSON files from an operator-supplied private path. It never prints source
records or ticket text. Its output is a reduced JSON document:

```json
{
  "version": 1,
  "exportedAt": "2026-10-27T12:00:00.000Z",
  "items": [
    {
      "zendeskTicketId": 12345,
      "status": "pending",
      "updatedAt": "2026-10-26T12:00:00.000Z",
      "fingerprint": "<64 lowercase hexadecimal characters>"
    }
  ]
}
```

The command accepts only the six Zendesk statuses `new`, `open`, `pending`,
`hold`, `solved` and `closed`, a numeric ticket ID, and a valid update time.
It extracts identity only from the known support-request email template in the
repository. Unknown or malformed formats are skipped. Category labels map to
the stable support category keys. The email is lowercased and trimmed; the
message has CRLF converted to LF and is trimmed. A SHA-256 digest is computed
over the JSON encoding of `[category, normalisedEmail, normalisedMessage]`.
No username, current account match, ticket text, or email address is included
in the manifest. Console output contains aggregate counts only.

## Preview and apply

The admin upload accepts only this reduced manifest, with a 10 MiB request
bound and a bounded item count. Raw Zendesk exports are processed locally and
are never uploaded. The service validates the complete manifest before
creating a preview.

Matching is exact by fingerprint. A preview candidate is eligible only when
one manifest row maps to one local support request and neither side has a
duplicate fingerprint. Repeated ticket IDs, conflicting prior ticket IDs,
ambiguous matches, malformed rows, unknown fingerprints and newer local
activity are skipped. The service does not match usernames or search current
member data.

For each eligible row, the preview stores only the actor, expiry, ticket ID,
proposed status and update time, support request ID, fingerprint, counts, and
the local status/version/activity snapshot needed for a compare-and-set during
apply. It stores no original ticket body, email, username, search text, or
manifest payload. Preview IDs are database-generated ObjectIds, actor-bound,
expire after 30 minutes, and are indexed for TTL cleanup.

Before an item can be applied, the service rechecks its status revision,
status, activity timestamps, fingerprint and ticket-ID conflict. Any change
since preview causes that item to be skipped. Applying updates only the
status-import metadata and status; it does not send mail or modify requester,
investigation, or member-link fields. Reapplying a completed preview is
idempotent. Audit records contain actor, route, preview ID and aggregate
counts only; audit failure prevents the corresponding operation.

## UI

Only administrators see the import control. The browser reads and parses the
selected reduced JSON file locally, then sends it to the preview endpoint. The
preview shows aggregate outcomes and concrete proposed status changes using
request IDs and Zendesk ticket IDs, without showing requester identity or
correspondence. Apply is available only after a successful preview and reports
applied and skipped counts.
