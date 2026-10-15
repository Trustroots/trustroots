# View-only member masquerading

## Why

Administrators need to reproduce what a member sees when investigating a
problem. The existing administration report shows account information, but
browses profiles with the administrator's permissions. A temporary member view
would let administrators inspect the actual member experience without changing
the member's account or activity.

## What changes

- Add a “View as this member” action to the administration member report.
- Require the administrator's current password and an investigation reason to
  begin a view-only session lasting at most 15 minutes.
- Keep the authenticated administrator and effective member identities
  separate; apply the member's ordinary visibility and ownership rules.
- Enforce view-only access on the server, including suppression of automatic
  activity updates, read receipts, push registration and other browsing effects.
- Show a persistent, accessible banner identifying the member, expiry and a
  return action, including on pages that normally hide the application header.
- Record entry, exit, expiry and permitted member API access with the real
  administrator and target identities, without recording private content.
- Reject stale browser contexts during identity transitions, including other
  tabs and in-flight requests.

## Capabilities

### New capabilities

None.

### Modified capabilities

- `admin-moderation`: Temporary, audited, view-only access to a member's view.

## Impact

- Users module: Passport-adjacent session context, authentication responses,
  administrator reauthentication and automatic last-seen/IP updates.
- Admin module: member-report entry control, lifecycle endpoints and audit log.
- Core module: request guard, bootstrap context, shared HTTP client and banner.
- Messaging and other member clients: suppress automatic writes and explain
  unavailable actions during masquerading.
- Server, client and end-to-end regression coverage using fictional accounts.
- No member-data migration or new dependency is expected. New optional session
  and audit metadata must remain compatible with ordinary existing sessions.
  Update the module graph only for deliberate new module relationships.

## Scope

View-only includes the private pages the member can normally access, such as
their inbox and settings. It does not grant additional administrator privileges
within that view. Sending, editing, downloading a full account export and
credential operations are excluded. Suspended accounts, other administrators
and the current account cannot be selected in this initial version. Member
notification and member consent workflows are outside this initial proposal.
