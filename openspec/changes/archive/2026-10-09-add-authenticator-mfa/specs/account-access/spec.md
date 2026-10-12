## ADDED Requirements

### Requirement: Authenticator MFA

Members MAY enable authenticator-app MFA using TOTP. Enrolment SHALL remain pending until the member confirms a valid code. The system SHALL encrypt pending and active TOTP secrets with AES-256-GCM using a dedicated deployment key, separate from the session and password keys. The deployment SHALL document key generation, configuration, rotation, and backup requirements.

#### Scenario: A member enrols an authenticator

- **WHEN** a member confirms their current password and requests enrolment
- **THEN** the system returns a one-time authenticator provisioning URI and a pending secret
- **AND** it does not mark MFA active until a valid, unused TOTP is verified
- **AND** the pending secret expires after a short period

#### Scenario: An active member verifies MFA

- **WHEN** a member signs in with a valid password and has MFA enabled
- **THEN** the password check creates only a short-lived pre-authentication challenge
- **AND** the system establishes an authenticated session only after a valid TOTP or recovery code
- **AND** concurrent requests cannot consume the same TOTP time step or recovery code more than once

#### Scenario: A member manages MFA

- **WHEN** a member views or changes MFA settings
- **THEN** the system never returns the active secret or recovery-code hashes
- **AND** enrolment, replacement recovery codes, and disablement require a recent password confirmation
- **AND** replacement recovery codes are shown only once and previous codes stop working atomically

#### Scenario: A privileged account lacks verified MFA

- **WHEN** an administrator, moderator, or other configured privileged role has no verified MFA session
- **THEN** privileged routes treat that account as an ordinary member
- **AND** promotion of a privileged account requires MFA to be enrolled and verified before privileged access is granted

#### Scenario: Account recovery does not bypass MFA

- **WHEN** a member resets or changes their password, confirms an email address, or uses another direct login path
- **THEN** the operation cannot establish an MFA-verified session without a successful second factor
- **AND** credential changes invalidate older sessions

#### Scenario: MFA verification is rate limited

- **WHEN** a client submits too many sign-in challenges, TOTP codes, recovery codes, or password confirmations
- **THEN** the system applies bounded IP and account or challenge limits and returns a retry response
