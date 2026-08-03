# Add reason column to unsubscribed newsletter CSV

## Why

Admins currently receive an unsubscribed CSV without context for why each
address is excluded from the subscriber list. They need explicit reasons to
clean mailing lists and follow up appropriately.

## What Changes

- Extend the unsubscribed CSV output from the newsletter split tool with a
  `Reason` column.
- Populate a deterministic exclusion reason per row, including:
  missing account, newsletter disabled, non-public profile, restricted role,
  and pending profile deletion.

## Affected Modules

- `modules/admin/server/controllers/admin.newsletter.server.controller.js`
- `modules/admin/tests/server/admin.newsletter.server.controller.tests.js`
- `modules/admin/tests/server/admin.newsletter.server.routes.tests.js`

## Compatibility and Deployment

- No schema or API route changes.
- The JSON response structure is unchanged except for richer unsubscribed CSV
  content.
