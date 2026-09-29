# Harden password recovery and revoke sessions after credential changes

## Why

The password recovery endpoint currently reveals whether a username or email belongs to an account. Password reset also reads a reset token and later saves the user, so concurrent requests can both use the same token. Password changes and resets record `passwordUpdated`, but sessions only store the member ID and remain valid in other browsers.

## What Changes

- Return the same successful status and generic message immediately, before account lookup, whether an account exists or not; do not expose lookup, persistence, or email delivery failures in the response.
- Perform token creation, account lookup, persistence, and email enqueueing as best-effort background work. The existing Agenda email queue remains durable after the email is enqueued; the initial in-process handoff can be lost if the application exits before it is persisted.
- Apply a password reset, token consumption, password update timestamp, and authentication-version increment in one conditional database update that only matches a valid, unexpired token.
- Store an account authentication version (default `0`) in Passport sessions and reject sessions whose version no longer matches the account. Increment the version atomically whenever a password is reset or changed, and whenever an administrator actually changes roles. Repeating a role request that leaves the roles unchanged does not revoke sessions. Existing sessions using the legacy ID-only format will be invalidated once after deployment.
- Preserve Passport 0.7 login/logout session regeneration and the existing local password hash format.
- Keep reset-token storage and its 24-hour lifetime unchanged; evaluate token hashing and expiry reduction separately.

## Affected Modules

- `modules/users` server password controller, user model, Passport session configuration, recovery client copy, and server/client tests.
- `modules/admin` role mutation controller and tests.
- `modules/users/server/jobs` is not changed; recovery work starts in-process and uses the existing durable email queue once the email is rendered.
- `openspec/specs/account-access` account recovery, password change, and session behaviour.
- `tests/e2e` account recovery and cross-session revocation coverage.

## Compatibility and Deployment

No database migration is required. Existing users receive the authentication-version default when loaded, and atomic `$inc` operations initialise the field to `1` when a legacy database document has no value. The session payload changes from a member ID to a member ID plus authentication version; any pre-deployment ID-only session is treated as stale and requires sign-in again. Password reset links and stored token fields remain compatible. The password hash algorithm and stored hashes do not change.

## User-facing Behaviour

The recovery form immediately receives the same success response, including for unknown usernames or email addresses. A process exit before the best-effort recovery work reaches the existing durable email queue can drop that request; the acknowledgement does not guarantee that an email was queued. The member who completes a password reset is signed in on that browser, while sessions in other browsers are invalidated. Changing a password has the same account-wide session revocation behaviour. An administrator role change also requires existing sessions to sign in again; a no-op role request does not.
