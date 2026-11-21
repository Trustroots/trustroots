## ADDED Requirements

### Requirement: Better Auth passkey-first evaluation

The evaluation SHALL use local test accounts to assess passkey-first sign-in
to an existing member account, password sign-in, 2FA and session revocation.
It SHALL document any integration work required to enforce Trustroots'
factor policy and preserve the existing member identity.

#### Scenario: A member signs in with an enrolled passkey first

- **WHEN** an existing test member presents an enrolled, user-verified passkey
- **THEN** the evaluation checks whether the resulting sign-in resolves to the same member account

#### Scenario: A sign-in method requires an additional factor

- **WHEN** a sign-in starts with a valid primary credential and the account requires a separate factor
- **THEN** the evaluation checks whether any full session is available before that factor succeeds
- **AND** it records the observed behaviour and any integration work needed to enforce the policy

#### Scenario: A member revokes sessions

- **WHEN** a test member revokes their sessions
- **THEN** the evaluation checks that a previously authenticated cookie cannot load the session
