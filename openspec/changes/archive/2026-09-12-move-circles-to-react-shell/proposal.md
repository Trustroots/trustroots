# Move circles to the React shell

## Why

The circle catalogue already uses React components inside Angular. Moving the
catalogue and circle details to the existing React shell provides a bounded
next step in the client transition and can be deployed on the current runtime.

## What Changes

- Render `/circles` and `/circles/:circle` through the existing React shell.
- Preserve membership updates, guest registration links, member-only circles,
  legacy tribe redirects, and navigation to Angular-owned member workflows.
- Keep circle descriptions within the application's supported HTML formatting.
- Refresh compatible request and mail dependencies and improve temporary-upload
  cleanup and ownership of server-managed profile fields.
- Retain the current Node, npm, React, Webpack and database versions.

## Affected Modules

- `modules/core`: route selection and the existing React shell.
- `modules/tribes`: catalogue, detail rendering and membership controls.
- `modules/users`: profile updates and upload handling.
- Dependency lockfile and client, server and end-to-end regression coverage.

## Compatibility and Deployment

This change targets main independently of PR 2769. Both application roots remain
available and cross-root navigation loads the destination root normally. No
database migration or configuration change is required.
