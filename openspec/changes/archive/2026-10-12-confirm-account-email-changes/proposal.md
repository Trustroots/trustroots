# Confirm account email changes

## Why

Members should have a clear, consistent way to approve changes to their account email and receive updates at their previous address.

## What Changes

Require a fresh credential confirmation before staging an email change. Confirm the proposed address before replacing the current address, notify the previous address, and give members a clear pending-change and cancellation flow.

## Impact

Users profile controller, account settings, transactional email templates, request limits and account-access tests. The change uses the account action token and MFA primitives delivered with the integrated account-access base. Existing account email addresses remain unchanged until the new address is confirmed. Native clients must provide the same fresh password and, when enabled, MFA proof before the server accepts an email change.
