# Define expiring single-use email confirmations

## Why

Email confirmation links should follow one predictable lifecycle across signup, resend, reminders and account email changes.

## What Changes

Give newly issued confirmation links a 24-hour lifetime and consume the current link atomically. Replacements invalidate earlier links, and reminder workers use the same issuance rules. Define a bounded transition for links issued before deployment.

## Impact

Users authentication/profile controllers, reminder job, action-token service, configuration, email templates and account-access tests. New metadata is additive; deployment must explicitly define the legacy-link grace window.

## Delivery

The implementation is included with the proposal. Deployments set one absolute, shared legacy-link deadline seven days after rollout; the operational guide describes the setting.
