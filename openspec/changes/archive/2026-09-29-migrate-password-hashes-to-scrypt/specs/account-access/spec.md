## ADDED Requirements

### Requirement: Versioned password verifiers

The system SHALL store newly registered, reset, or changed local account passwords using an asynchronous, salted, versioned adaptive password verifier that records its algorithm and work parameters.

#### Scenario: New password is stored

- **WHEN** a person registers or sets a new password
- **THEN** the system stores only a verifier in the current versioned format
- **AND** the verifier records its algorithm, work parameters, random salt, and derived key
- **AND** the plaintext password is not logged or returned

#### Scenario: Current verifier authenticates

- **WHEN** an account holder submits the password matching a supported current verifier
- **THEN** the system authenticates the account holder
- **AND** the KDF runs asynchronously

### Requirement: Legacy password verifier compatibility

The system SHALL continue to verify existing PBKDF2-HMAC-SHA1 password records during migration and SHALL upgrade a valid legacy record after successful sign-in without changing the account password or invalidating its sessions.

#### Scenario: Account holder signs in with a legacy password

- **WHEN** an account holder submits the password matching a legacy PBKDF2-HMAC-SHA1 record
- **THEN** the system authenticates the account holder
- **AND** the system replaces the legacy verifier with the current versioned verifier if the stored legacy verifier is still unchanged
- **AND** the system removes the separate legacy salt
- **AND** the rehash does not change the password-updated timestamp or authentication version

#### Scenario: Legacy password changes during verification

- **WHEN** the stored password record changes after a legacy verifier has been read but before its upgrade is saved
- **THEN** the system does not overwrite the newer record
- **AND** the system does not create an authenticated session based only on the stale verification

#### Scenario: Stored verifier uses an unsupported format

- **WHEN** a stored verifier is malformed or uses an unsupported version or algorithm
- **THEN** the system treats the credentials as invalid
- **AND** the system does not fall back to plaintext comparison or accept partially parsed parameters

### Requirement: Uniform invalid password responses

The system SHALL return the same generic credential failure for unknown accounts, incorrect passwords, malformed password records, and unsupported password verifier formats.

#### Scenario: Person submits invalid credentials

- **WHEN** a person submits credentials that do not match a supported password verifier
- **THEN** the system shows the generic invalid-credentials response
- **AND** the response does not reveal whether the account exists or which verifier format it uses

### Requirement: Bounded password verification work

The system SHALL run password derivations asynchronously with current verifier
parameters restricted to an explicit supported allowlist and SHALL bound active
and queued derivations per application process.

#### Scenario: Password verifier parameters are malformed or unsupported

- **WHEN** a stored verifier has parameters or encodings outside the supported
  format
- **THEN** the system treats the credentials as invalid
- **AND** it performs dummy current-cost verification work
- **AND** it does not execute an attacker-selected KDF cost

#### Scenario: Password verification queue is full

- **WHEN** an authentication request arrives after the active derivation and
  bounded queue are full
- **THEN** the system returns a generic retryable service-unavailable response
- **AND** it does not fall back to a cheaper verifier
- **AND** it exposes only active and queued counts to operational monitoring
