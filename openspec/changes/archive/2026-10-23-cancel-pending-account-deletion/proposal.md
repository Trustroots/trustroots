## Why

Members need to withdraw a pending account deletion request and invalidate its confirmation link before deletion is confirmed (issue #2749).

## What Changes

- Add an authenticated pending-deletion status and cancellation API scoped to the current member.
- Show pending requests and an explicit cancellation control in Account settings.
- Include a cancellation link in both deletion email variants leading to Account settings.
- Make the email warning explicit that confirmed deletion is permanent.
- Cover request, cancellation, expired requests, and subsequent confirmation with unit, route and browser tests.

## Impact

- Affected specs: account-access.
- Affected code: users routes, policy, profile controller, account settings and API; core deletion email templates and service.
- Existing confirmation links remain supported until cancelled or expired. Opening a cancellation link does not change account state.
