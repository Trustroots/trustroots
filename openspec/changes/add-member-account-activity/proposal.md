# Add a member account activity history

## Why

Members should be able to review recent account access and credential changes from account settings.

## What Changes

Record a bounded set of account activity events and provide a member-only, paginated history. Show new sessions, password/email/MFA changes and recovery-code usage with clear timestamps and action labels.

## Impact

Users authentication/account services, a dedicated activity model, account-settings UI, TTL/index maintenance and tests. Integrates with session, token and MFA work. Adds a collection with a 90-day retention policy; no historical events are reconstructed.

## Delivery

This is a proposal-only change. Runtime implementation, migrations and deployment are separate follow-up work after the design is reviewed. The proposal remains unarchived until implementation is complete.

