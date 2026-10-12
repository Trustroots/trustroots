## 1. Recovery response and reset consistency

- [x] 1.1 Make recovery response status and text indistinguishable for known and unknown accounts.
- [x] 1.2 Atomically update the password and consume a valid, unexpired reset token once.
- [x] 1.3 Update recovery UI and anonymous server/client regression coverage, including an acknowledgement-before-stalled-email case.

## 2. Account-wide session revocation

- [x] 2.1 Add an authentication version to account records and Passport session payloads; invalidate stale and legacy sessions.
- [x] 2.2 Increment the version on password reset and authenticated password change while retaining the current browser's new session.
- [x] 2.3 Increment the version atomically with real administrative role changes; leave no-op role requests unchanged.
- [x] 2.4 Add tests for legacy ID-only sessions, deleted accounts, real and no-op role changes, current-browser refresh, and two-session reset/change revocation.

## 3. Specification and verification

- [x] 3.1 Update the account-access specification for recovery privacy, single-use tokens, and account-wide session revocation.
- [x] 3.2 Strict OpenSpec validation passed. The PR's server, client, end-to-end, coverage-summary, lint, ESLint, and image-build checks all passed; the server and client remain at 100% coverage.
