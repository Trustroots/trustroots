## Why

The old mobile application is retired. Remove its unused push integration while
browser push is evaluated separately in #2829.

## What Changes

- Remove the Expo push adapter and SDK.
- Accept new push registrations only for the browser platform.
- Ignore historical mobile targets when processing push jobs.
- Preserve historical registration records and their removal endpoint, so existing
  profiles remain valid without a data migration.
- Preserve the current disabled-delivery behaviour and browser Firebase code.

## Impact

The registration API intentionally stops accepting retired mobile platforms.
There is no database migration. Existing users may still save profiles containing
historical registrations and remove them. Email notifications remain unchanged.
