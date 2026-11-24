## Why

Avatar processing should release its processing slot and private staging resources when the upload deadline expires.

## What Changes

- Run native avatar thumbnail generation in an individual child process.
- Wait for the child to stop before cleaning private staging and releasing its processing slot.

## Capabilities

### Modified Capabilities

- `member-profiles`: Define the lifetime of native avatar processing.

## Impact

The users server module and its avatar-processing tests.
