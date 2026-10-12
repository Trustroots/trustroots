## ADDED Requirements

### Requirement: Combined account access regression matrix

The test suite SHALL exercise the combined session, account action token, sign-in challenge and MFA behaviour against one application build. It SHALL retain existing feature scenarios and coverage thresholds.

#### Scenario: Password recovery on an MFA account

- **WHEN** a valid password reset is completed for an MFA-enabled member
- **THEN** the token is consumed once and previous sessions no longer authorise requests
- **AND** the member must complete the documented MFA sign-in flow

#### Scenario: Additional login checks are combined

- **WHEN** an account requires both a sign-in challenge and MFA
- **THEN** the browser completes the checks in order and establishes one session
- **AND** intermediate responses do not count as a successful signed-in member

### Requirement: Concurrent lifecycle and client compatibility tests

The integration suite SHALL verify single-use credentials using concurrent requests and SHALL cover supported browser/native capability outcomes with anonymous fixtures.

#### Scenario: Credential is submitted concurrently

- **WHEN** concurrent requests use the same action token, recovery code or proof
- **THEN** their outcomes match the credential's documented single-use policy

#### Scenario: Client lacks a required authentication capability

- **WHEN** a native client encounters an unsupported required step
- **THEN** it presents the supported compatibility outcome without storing an authenticated session

