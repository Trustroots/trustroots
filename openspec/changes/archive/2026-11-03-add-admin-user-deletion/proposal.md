## Why

Administrators can suspend accounts but cannot complete a requested or necessary account deletion from the member report.

## What Changes

- Allow administrators to permanently delete an already suspended member from their report.
- Require the exact username and a reason, reject self-deletion and administrator targets, and recheck suspension when deleting.
- Record the actor, target and reason before deletion; fail closed if the audit cannot be saved.
- Support optional keyword labels in deletion audit records, distinct from signup review rules.
- Add an administrator-managed list of signup review keywords, exact email addresses and exact email domains. Matching signups remain allowed and alert staff through the existing flagged-signup workflow. Preserve the current three keyword defaults until administrators save a replacement list.
- Reuse the existing profile removal cleanup, continuing after individual cleanup failures and reporting incomplete cleanup separately from account deletion. Keep confirmation emails for self-service removal only. Retain historical messages, experiences and moderation records according to the existing deletion behaviour.
- Require explicit acknowledgement before saving an empty watchlist, enforced by both the client and API.

## Impact

Affected modules: admin, users and shell routing. Adds admin APIs, a member-report control and a signup review rules page. Stores the rule list as one versioned configuration document; no migration, dependency change or deployment configuration is needed. Existing self-service deletion remains available. PR #3218 is independent and remains unmerged.
