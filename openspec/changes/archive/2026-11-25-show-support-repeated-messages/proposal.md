## Why

Support needs to see when a sender reused the same message across many recipients while reviewing a verified report or a sending alert.

## What Changes

- Add a repeated-message view to verified reports and message-throttle reviews.
- Show exact message text, send and distinct-recipient counts, and first and last send times for groups reaching at least three recipients.
- Restrict each lookup to its case or alert window and audit access.

## Impact

Adds read-only Support endpoints and a sender/date message index.
Production disables automatic index creation. Before deploying, run
`db.messages.createIndex({ userFrom: 1, created: -1 })` on the application
database. There is no message backfill.
