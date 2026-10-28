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

| Status  | Meaning                                |
| ------- | -------------------------------------- |
| New     | A newly received request               |
| Open    | Needs a support response               |
| Pending | Waiting for the requester              |
| On hold | Waiting for another dependency         |
| Solved  | Support considers the request resolved |
| Closed  | Archived as complete                   |

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

Historical statuses are matched only by the fingerprint of the original
category, recorded requester email and original message. Current usernames and
fuzzy matching are never used. A repeated import is idempotent.

## External connections

Admin and support member pages show current external profile links and their
history. The **External connection search** staff page searches by network and a complete
identifier or recognised profile URL, including identifiers that a member has
replaced or removed. Results distinguish current connections from previous ones.
The same panel and search also include email addresses; an email change enters
history only when the new address is confirmed. Earlier addresses that were
replaced before this feature was deployed cannot be recovered by the backfill.
An identifier match is not proof that two accounts belong to the same person;
external usernames may be reassigned.

History covers hospitality networks, Nostr and legacy Facebook, Twitter and
GitHub profile identifiers. Initial snapshots have an unknown original date;
links removed before tracking began cannot be recovered. History is available
only to administrators and support-team members and is deleted with the account.
Provider credentials are never copied into history.

### Deployment and backfill

Deploy the application changes before initialising existing accounts. With the
target environment's database configuration, run:

```sh
NODE_ENV=production pnpm run ensure-indexes User
NODE_ENV=production node bin/db-maintenance/backfill-connection-history.mts
```

The backfill processes accounts through a cursor and conditionally writes each
initial snapshot. It can be rerun after interruption; concurrent member edits
are retained. Exact search is complete for existing accounts once the backfill
finishes. New accounts and edited connections are tracked immediately. The
`user_connection_search_keys` index supports exact lookup without making external
identifiers unique across members.

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
