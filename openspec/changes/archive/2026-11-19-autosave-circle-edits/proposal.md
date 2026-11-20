## Why

Administrators can change an existing circle without creating a new catalogue entry. Saving those edits directly reduces the chance of leaving an update unsubmitted.

## What Changes

- Save valid edits to existing circles automatically using the existing update endpoint.
- Show saving, success and retryable error messages in the editor.
- Keep new circle creation explicit.
- Show linked member cards for organisers in the editor.

## Impact

- Affected spec: admin-moderation
- Affected code: circle editor and existing admin circle browser tests
