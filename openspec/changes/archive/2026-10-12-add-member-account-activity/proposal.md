# Add a member account activity history

## Why

Members should be able to review recent account access and credential changes from account settings.

## What Changes

Record a bounded set of account activity events and provide a member-only, paginated history. Show new sessions, password/email/MFA changes and recovery-code usage with clear timestamps and action labels.

## Impact

Users authentication/account services, a dedicated activity model, account-settings UI, TTL/index maintenance and tests. Integrates with session, token and MFA work. Adds a collection with a 90-day retention policy; no historical events are reconstructed.

## Delivery

Implemented with a 90-day API retention window, owner-only paginated history,
account-settings interface, activity recording at completed account/session
transitions, deployment index guidance, and automated server, client and
browser tests.

