# Add a support team role

## Why

Support volunteers need account and safety investigation tools without full administrator authority. Reports currently arrive by email and have no verified member-pair link for limiting private conversation access.

## What Changes

- Add an administrator-managed `support-team` role with current greeter tools, allowlisted member search/details and internal notes.
- Add an inbox for all support requests with open/resolved status; replies remain in the existing email system.
- Link authenticated member reports to immutable member IDs. Permit support to read the entire linked pair's conversation and experiences, including hidden messages and unpublished feedback, after resolution too.
- Audit support access. Keep moderation actions, unrestricted conversations, exports and audit browsing administrator-only.
- Keep historical reports unlinked unless both identities are verifiable; never infer historical identity solely from current username ownership.

## Impact

Affected modules: admin, support, users, core routing/navigation and tests. Additive fields on support requests require no destructive migration. Existing requests default to open. No automatic role grants or moderator conversions. The removed acquisition analysis page is not restored: support inherits the greeter tools available on main.
