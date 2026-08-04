# Surface potential accounts related to restricted members

## Why

Administrators investigating a suspended or shadowbanned member currently need
to repeat several manual searches to notice likely replacement or related
accounts. The member's acquisition story is also only available inside raw
profile data, even though repeated stories can be a useful supporting signal.

## What Changes

- Show a restricted member's acquisition story as readable moderation context
  on their report card.
- Find a bounded set of other accounts whose username or email local-part
  resembles the restricted member's identifiers, or whose acquisition story is
  identical after trimming and case normalisation.
- Show the possible accounts and the reason each one matched on the restricted
  member's report card.
- Treat matches only as investigation leads; do not automatically restrict or
  otherwise change any account.

## Impact

- Affects the administrator member-report API and React report-card view.
- Matching runs only when an administrator opens a suspended or shadowbanned
  member report and returns a bounded result set.
- No data migration or public API change is required.
- Adds server, client, and end-to-end regression coverage.
