## Why

The application still uses Mongoose 5 while its native MongoDB client and Agenda
are moving to the 4.x driver. Aligning the ORM with that driver removes a second
database client generation and keeps the data layer maintainable.

## What Changes

- Upgrade Mongoose to the maintained 6.13 release line and adapt connection,
  indexing, schema, and query code to its interfaces.
- Use the existing MongoDB 4 driver shared with Agenda and the session store.
- Preserve the current MongoDB 4.4 server requirement and application data.
- Verify member, messaging, session, and background-job database behaviour.

## Impact

The lockfile, database bootstrap, model integrations and affected tests change.
Deploy the application and worker together. A rollback restores the previous
images without transforming stored documents.
