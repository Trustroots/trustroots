## Why

Trustroots is evaluating whether Better Auth can own sign-in, sessions, 2FA
and passkeys. Start with a passkey as an existing member's first sign-in
method, with a password available for existing accounts. See #3660.

## What changes

- Evaluate password and passkey-first sign-in, database sessions, revocation
  and TOTP in an isolated browser probe.
- Record what the library provides and what Trustroots would need to build
  before preserving its account, recovery and authorisation rules.
- Define the tests required before connecting a web pilot to existing members.

## Impact

- Affected spec: `account-access`.
- The evaluation runs on local test accounts. It adds no runtime dependency,
  route, schema migration or deployment configuration to Trustroots.
- #3059 covers staff MFA on the existing stack. Review its staff access
  requirements before choosing a Better Auth rollout.
