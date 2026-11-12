## Why

Gravatar used to be the default avatar source. Administrators need to know how many accounts would lose an image if Trustroots retires Gravatar.

## What Changes

- Add a button to check photo availability for accounts that still use Gravatar.
- Show aggregate counts and progress without changing member profiles.
- Query Gravatar on the server using the same stored hashes used to serve avatars.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Measure Gravatar photo availability across the remaining accounts.

## Impact

Adds an administrator-only API for starting and viewing the check. Results are kept in the web server process and expire when it restarts.
