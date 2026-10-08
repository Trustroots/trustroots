## ADDED Requirements

### Requirement: Account-wide sign-in protection

The system SHALL enforce a shared attempt limit for each normalised submitted
username or email identifier, across trusted client addresses, while retaining
the existing address-based request limits and bounded password-verification
queue. After the account-wide threshold, the system SHALL require a short-lived
proof-of-work challenge bound to the identifier and trusted client address.
Challenges SHALL be single-use and SHALL not persist account identifiers in
plaintext. Failed or repeated attempts SHALL not permanently lock an account.

#### Scenario: Account threshold requires additional work

- **WHEN** sign-in attempts for a normalised account identifier exceed the
  shared threshold across addresses
- **THEN** the server returns HTTP 429 with a signed challenge and fixed
  difficulty
- **AND** a valid proof permits one password verification

#### Scenario: Supported clients complete a challenge

- **WHEN** the browser, Android client, or iOS client receives the challenge
- **THEN** it computes a bounded proof without blocking the user interface
- **AND** retries credentials with the proof at most once

#### Scenario: Challenge is expired, replayed, or bound to another identity

- **WHEN** a challenge is expired, already consumed, or presented for another
  identifier or trusted address
- **THEN** the server rejects the proof and requires a fresh challenge

#### Scenario: Ordinary address throttling is reached

- **WHEN** a sign-in request reaches an existing address-based limit
- **THEN** the server returns its ordinary rate-limit response without a
  proof-of-work challenge
