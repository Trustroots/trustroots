## Why

Shadowbanned and suspended members can still appear in public member-search
results, receive or create contact requests, and receive welcome-sequence
emails. These gaps expose restricted activity to other members or continue
automated communication that moderation intended to suppress.

## What Changes

- Exclude suspended and shadowbanned profiles from public member search.
- Reject contact requests when either participant has a suspended or
  shadowban role, before a contact record is created.
- Exclude shadowbanned members from all three welcome-sequence jobs, matching
  the existing suspended-member exclusion.

## Capabilities

### Modified Capabilities

- `offers-and-search`: Member search excludes restricted profiles.
- `relationships-safety`: Restricted members cannot create or receive contact
  requests.
- `account-access`: Restricted members do not receive welcome-sequence emails.

## Impact

- Updates the public user-search, contact-request, and welcome-email job
  queries.
- Adds server and end-to-end regression coverage for the restricted-member
  behaviour.
- Does not require a migration or configuration change.
