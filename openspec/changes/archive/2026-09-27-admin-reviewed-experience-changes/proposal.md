# Admin-reviewed Experience changes

## Why

Members cannot correct or request removal of an Experience after submitting it.
Support currently needs manual intervention for these requests. A short-lived,
admin-issued link can make individual requests possible without exposing general
editing controls, while retaining an approval step before published content changes.

## What Changes

- Administrators can find an Experience and issue a seven-day link for its author
  or recipient. Each link is scoped to that Experience and member; replacement
  invalidates an earlier link for the same pair.
- The author can propose edits to feedback, recommendation, and interactions or
  request removal. The recipient can request removal. Requests need a valid link
  and the matching signed-in account.
- Administrators review one pending request per Experience and approve or reject
  it. Until approval, the existing Experience remains unchanged.
- Approved removal hides the Experience from member views and aggregate data
  while retaining it for administration. An approved edit preserves its creation
  date and visibility.
- Requesters can see the outcome after link expiry, but cannot submit another
  request without a valid link.

## Compatibility and Deployment

Existing Experiences remain active; absent removal fields mean not removed.
No data migration or shared secret is required. Tokens are stored hashed and
issued only by administrators. The existing reference feature flag controls the
new member routes.

## Affected Modules

- `modules/experiences` for links, requests, approvals, and visibility
- `modules/admin` for link issuance and the review queue
- `modules/statistics` for excluding removed Experiences
- `tests/e2e` for the member and administrator flow
