# Define expiring single-use email confirmations

## Why

Email confirmation links should follow one predictable lifecycle across signup, resend, reminders and account email changes.

## What Changes

Give newly issued confirmation links a 24-hour lifetime and consume the current link atomically. Replacements invalidate earlier links, and reminder workers use the same issuance rules. Define a bounded transition for links issued before deployment.

## Impact

Users authentication/profile controllers, reminder job, action-token service, configuration, email templates and account-access tests. Coordinate with the digest-storage PR. New metadata is additive; deployment must explicitly define the legacy-link grace window.

## Delivery

This is a proposal-only change. Runtime implementation, migrations and deployment are separate follow-up work after the design is reviewed. The proposal remains unarchived until implementation is complete.

