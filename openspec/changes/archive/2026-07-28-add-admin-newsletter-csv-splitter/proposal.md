# Add admin newsletter CSV splitter

## Why

The admin newsletter page is currently a placeholder and does not help admins
reconcile historical mailing-list exports with current newsletter preferences.
Admins need a practical way to upload an email CSV and separate it into people
who are still subscribed and people who are no longer subscribed.

## What Changes

- Add an admin-only API endpoint that accepts an uploaded CSV file, extracts
  email addresses, and checks each address against current member newsletter
  preferences.
- Return two generated CSV outputs from that API: one for members who are still
  subscribed and one for members who are unsubscribed.
- Replace the `/admin/newsletter` placeholder with a working tool that lets
  admins upload a CSV and download both generated CSV files.
- Keep existing admin access controls and audit-log recording for newsletter
  actions.

## Classification Rules

- **Still subscribed** means the matched member record has `public: true` and
  `newsletter: true`.
- **Unsubscribed** includes uploaded emails that do not match a currently
  subscribed public member.

## Affected Modules

- `modules/admin/server` (newsletter controller and routes)
- `modules/admin/client` (newsletter page and API client)
- `modules/admin/tests` (server and client coverage)
- `tests/e2e/features/admin-moderation` (end-to-end behaviour coverage)
- `tests/e2e/feature-coverage.js` (feature registry updates)

## Compatibility and Deployment

- No schema migration required.
- Existing disabled download routes remain unchanged unless explicitly re-enabled.
- The new API is admin-only and returns generated CSV text in JSON for client-side download.
