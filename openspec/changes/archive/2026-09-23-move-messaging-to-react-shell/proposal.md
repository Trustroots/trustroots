# Move messaging pages to the React shell

## Why

The inbox and conversation components are already React components, but Angular
still owns their routes and unread-count startup. Rendering them through the
React shell removes that page dependency while preserving the existing message
APIs and member workflow.

## What Changes

- Render `/messages` and `/messages/:username` in the React shell.
- Keep named Angular states as redirects for links from remaining Angular pages.
- Start unread-count polling and favicon updates on React pages.
- Preserve the inbox, thread, reply, activation and deleted-member behaviour.

## Impact

This changes client route ownership, messaging page navigation and regression
coverage. The existing URLs, server APIs, access rules, Node 24 runtime and data
model remain compatible. No deployment or data migration is required.
