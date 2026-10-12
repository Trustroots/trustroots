## Why

The sign-in, account recovery, confirmation-resend and avatar-upload endpoints accept repeated requests without application-level limits shared across application instances. General Nginx throttling does not provide operation-specific identity controls and cannot protect deployments whose requests are spread across app instances.

## What Changes

- Add configurable, operation-specific request limits for sign-in, forgot/reset password, confirmation resend and avatar upload.
- Store atomic counters in MongoDB with bounded windows, hashed keys and TTL cleanup so limits apply across instances without retaining raw account identifiers or client addresses.
- Identify clients using the application's trusted client-IP rules; do not accept caller-supplied `X-Forwarded-For` values as identity.
- Return HTTP 429 with `Retry-After` when a policy is exceeded, while preserving the existing Nginx general limiter and message throttle.
- Document creation of the TTL index as a deployment prerequisite and support conservative production defaults with test policies that do not constrain existing localhost suites.

## Capabilities

### Modified Capabilities

- `account-access`: targeted controls for authentication, password recovery and confirmation resend.
- `member-profiles`: targeted control for avatar uploads.
- `database-platform`: shared atomic MongoDB counters and TTL cleanup for request limits.

## Impact

- Updates Express routes/controllers, configuration, MongoDB model/index setup, server tests and end-to-end coverage.
- Adds an abuse-limit collection and TTL index; deployment must apply the index before enabling the middleware in production. Existing account and profile data does not migrate.
