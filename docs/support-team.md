# Support team

Administrators can add or remove **Support team** on a member record. The role
provides the support inbox at `/admin/support`, member search and account details,
internal member notes, acquisition stories and the staff member's own blocker list.
It does not grant suspension, shadowbanning, role changes, bulk exports, audit-log
browsing or unrestricted private conversations. Legacy moderators are unchanged.

Requests default to open and can be resolved or reopened. Replies continue through
the existing support email system. Signed-in member reports link the reporter and
reported member using server-verified IDs. Support can then read their entire
conversation and all experiences between them, including hidden messages and
unpublished feedback. Reading does not mark messages read or publish experiences.
Access is audited and remains available after resolution.

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
NODE_ENV=production node bin/db-maintenance/link-support-reports.mjs mappings.json ADMIN_MEMBER_ID
NODE_ENV=production node bin/db-maintenance/link-support-reports.mjs mappings.json ADMIN_MEMBER_ID --apply
```

The tool refuses signed-out reports, missing members, self-pairs, targets created
after the report and attempts to replace an existing link with another member.
Evidence must establish historical identity; a current username match is insufficient.
