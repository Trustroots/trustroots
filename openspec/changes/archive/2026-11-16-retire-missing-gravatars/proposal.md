## Why

Gravatar was the default for new accounts. Profiles that have no Gravatar image still make external requests and inflate the selected-source count.

## What Changes

- Check eligible profiles in the background after a successful profile view.
- Add an explicit cleanup action to the Gravatar admin report alongside the read-only check.
- Switch the account to no photo only when Gravatar returns 404 with its default image disabled and the account's avatar settings still match.

## Capabilities

### Modified Capabilities

- `member-profiles`: Retire missing Gravatar images after a profile view.
- `admin-moderation`: Let administrators retire missing Gravatar images in a paced scan.

## Impact

The change affects the users and admin modules. The profile response retains its existing shape and does not wait for the check. The existing read-only admin action retains its request and response format. Cleanup updates the stored avatar source for confirmed misses. Existing photos continue to be served. No database schema or deployment configuration changes are needed.
