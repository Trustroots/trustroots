# Support team

Administrators can add or remove **Support team** on a member record. The role
provides the support inbox at `/admin/support`, member search and account details,
internal member notes, acquisition stories, location corrections and the staff
member's own blocker list.
It does not grant suspension, shadowbanning, role changes, bulk exports, audit-log
browsing or unrestricted private conversations. Legacy moderators are unchanged.

Requests use the new, open, pending, hold, solved and closed statuses. Replies
appear in the shared thread and are sent through the configured support mailbox.
Signed-in member reports link the reporter and reported member using
server-verified IDs. Support can then read their entire conversation and all
experiences between them, including hidden messages and unpublished feedback.
Reading does not mark messages read or publish experiences. Access is audited and
remains available after resolution.

## Using the inbox

The inbox starts with **Unresolved** requests: New, Open, Pending and On hold.
Choose an individual status or All, combine it with a category and search, and
copy the address to share the same selection with another support member.
Search includes the original request, replies, requester details and request or
linked Zendesk ticket IDs. Counts beside statuses respect search and category;
the overall total includes every request.

A request with an explicitly stored Open status is **Open**. A legacy request
with no stored status is **Unconfirmed**, not Open; the inbox counts and filters
it separately. **Unresolved** includes Unconfirmed requests as well as New,
Open, Pending and On hold.

| Status      | Meaning                                |
| ----------- | -------------------------------------- |
| New         | A newly received request               |
| Unconfirmed | No stored status was recorded          |
| Open        | Needs a support response               |
| Pending     | Waiting for the requester              |
| On hold     | Waiting for another dependency         |
| Solved      | Support considers the request resolved |
| Closed      | Archived as complete                   |

Replies use the shared Trustroots Support identity and remain visible to the
whole support team. SMTP acceptance normally moves a request to Pending;
acceptance does not prove final delivery. Any new requester reply reopens the
request, including a Closed request. Later manual changes and newer activity
take precedence over an earlier outgoing reply.

Delivery labels distinguish queued, accepted, failed and uncertain messages.
An uncertain outcome may already have reached the requester: check Zoho before
explicitly retrying it. Captured messages on test deployments were not sent.
Attachments are listed as notices; open Zoho to access the actual files.
Quoted correspondence is collapsed and can be expanded to read the stored text.
Oversized email notices also direct staff to the intact message in Zoho.

Replies to ordinary member-message notifications are outside this inbox's scope.
For mailbox setup and the production cutover, see
[support mail across environments](operations/support-mail-environments.md).

## Historical Zendesk statuses

Only an administrator can import historical statuses. Prepare the reduced
manifest on a trusted local machine from a private Zendesk JSON export or
NDJSON pages. The preparation command recognises only the support-request email
template used by this repository. Unknown formats, missing requester email,
unsupported statuses and repeated ticket IDs are skipped. Its output contains
only ticket IDs, statuses, update times and one-way identity fingerprints; it
does not include request text, email addresses or usernames.
The earliest website form is recognised by its complete generated footer,
including authentication, browser and ID fields, even though it predates the
later signature separator.

Before importing, run the support inbox migration in dry-run mode and review
its counts, including historical requests without a category. Applying the
migration assigns those requests `reportMember` when a stored reported-member
value exists and `other` otherwise; it never infers identity from a current
username. Category backfill is required for legacy messages to fingerprint the
same way as the Zendesk export.

```sh
pnpm support:migrate-inbox
pnpm support:migrate-inbox --apply
```

Keep the raw export in its private location. Create the reduced file with a
private path and review only the aggregate preparation counts:

```sh
pnpm support:prepare-zendesk-statuses -- --output /private/path/reduced-statuses.json /private/path/export.json
```

The command accepts multiple export files after the output path. It writes the
reduced JSON with owner-only file permissions. Do not commit or otherwise
publish either file. In **Admin → Support inbox**, select the reduced file,
review the proposed request and status changes, then choose **Apply status
changes**. The preview expires after 30 minutes. Imports skip ambiguous matches,
conflicting ticket IDs, local activity newer than the Zendesk update and requests
changed after preview. Applying statuses does not send email or change member
links or investigation access.

Exact matches use the original category, recorded requester email and original
message. Current usernames and fuzzy matching are never used. A repeated
import is idempotent.

Version 1 manifests remain supported and use exact fingerprint matches only.
To prepare a version 2 manifest with reduced evidence for reviewing possible
formatting variants, add `--matching-evidence`:

```sh
pnpm support:prepare-zendesk-statuses -- --matching-evidence --output /private/path/reduced-statuses-v2.json /private/path/export.json
```

Version 2 adds only one-way sender and normalised-message hashes, the original
category, and the submission time. It does not contain email addresses or
correspondence. Suggestions require the same original sender and category,
submission within 60 seconds, and an equivalent message after conservative
formatting normalisation. Missing submission time disables suggestions.
HTML-escaped and URL-expanded renderings are covered by this normalisation,
while preserving the fingerprint and identity of the original stored request.
The preview shows exact matches separately from suggestions and lists every
competing request by ID, category and submission time, with a link to each
request. Suggested matches never select themselves: choose at most one request
checkbox for each Zendesk ticket. Tickets with competing candidates are never
chosen automatically. If different manifest renderings point to the same local
request, all affected tickets are skipped as an ambiguous source match and
left unchanged.

The **Skipped during matching** table explains unmatched requests, repeated
fingerprints, ambiguous local matches, rendering collisions, existing ticket
links and newer local activity. It remains visible after applying. After
applying, the inbox refreshes its counts. A local request left without an
imported status appears as Unconfirmed; it does not mean Zendesk considered it
Open. To investigate an earlier import, preview the same reduced file again
and review these aggregate reasons before applying further changes.

## Historical reports

Signed-out and ambiguous reports remain visible but do not unlock private content.
Historical usernames may have changed owners, so do not link reports by matching
them against today's usernames.

An administrator may prepare a JSON array of verified mappings:

```json
[
  {
    "requestId": "111111111111111111111111",
    "reportedUserId": "222222222222222222222222",
    "evidence": "Immutable member ID verified in archived support correspondence."
  }
]
```

Run the maintenance tool with the verifying administrator's member ID. It defaults
to a dry run; add `--apply` to store and audit the links:

```sh
NODE_ENV=production node bin/db-maintenance/link-support-reports.mts mappings.json ADMIN_MEMBER_ID
NODE_ENV=production node bin/db-maintenance/link-support-reports.mts mappings.json ADMIN_MEMBER_ID --apply
```

The tool refuses signed-out reports, missing members, self-pairs, targets created
after the report and attempts to replace an existing link with another member.
Evidence must establish historical identity; a current username match is insufficient.
