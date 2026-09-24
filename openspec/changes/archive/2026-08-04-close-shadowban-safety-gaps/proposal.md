# Change: Close shadowban safety gaps

## Why

Several protections tracked by the shadowban moderation work are only partial:
existing contacts can still expose restricted accounts, shadow-hidden messages
still affect reply statistics, and one signup-reminder job still emails
shadowbanned members. Administrators also need a clearer foundation for future
role management without expanding mutation controls yet.

## What Changes

- Omit suspended and shadowbanned accounts from user-facing contact lists,
  including existing confirmed relationships.
- Exclude messages sent by restricted members from reply-rate and reply-time
  accounting.
- Exclude shadowbanned members from finish-signup reminder emails as well as
  suspended members.
- Confirm the existing external social, hospitality-network, and Nostr
  identifier protection remains covered for shadowbanned profile viewers.
- Add a read-only role-management panel to administrator member reports with
  the member's current roles and short descriptions.
- Remove an unreachable acquisition-story query fallback that prevents full
  server branch coverage.

## Impact

- Affected specs: `relationships-safety`, `messaging`, `account-access`,
  `admin-moderation`
- Affected areas: contacts aggregation, message-stat updates, signup-reminder
  jobs, profile-sanitisation coverage, and administrator member reports
- No new role mutation endpoint or persistent rules banner is introduced.
