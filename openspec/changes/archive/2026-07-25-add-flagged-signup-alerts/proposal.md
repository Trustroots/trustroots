## Why

Certain account names merit a quick internal safety review without blocking a
person's registration.

## What Changes

- Match configured hardcoded keywords against signup identifying text.
- Send a best-effort internal alert after a matching account is saved.
- Keep normal confirmation email and login behaviour unchanged.

## Impact

- Affects signup authentication and the internal email service only.
