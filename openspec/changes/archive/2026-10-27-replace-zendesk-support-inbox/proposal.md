## Why

The support inbox currently stores initial requests and triage status while correspondence requires an external helpdesk. Support needs shared, durable email conversations and a conservative way to retain historical ticket statuses when that service is retired.

## What Changes

- Add request deep links, six familiar statuses, combined search and filters, accurate totals and shared correspondence.
- Add durable outbound SMTP delivery and read-only Zoho IMAP intake, disabled until configured, with text-only correspondence and attachment notices.
- Add administrator-only preview/apply of a reduced one-time Zendesk status manifest prepared locally without publishing private correspondence.
- Preserve existing staff permissions, report-scoped investigation and anonymous test fixtures.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-moderation`: Shared support correspondence, status filtering, search/counts, deep links and conservative status import.
- `public-access`: Durable support submissions and threaded email acknowledgement when the inbox is enabled.

## Impact

The support and admin modules, shared route policies, SMTP worker, configuration and support documentation change. Add IMAP/MIME parsing dependencies. Existing resolved statuses migrate to solved; missing legacy statuses remain open. Intake is opt-in and production mailbox routing must be verified before enablement. No real archive data or credentials belong in the source tree, fixtures, logs or public GitHub text.
