## ADDED Requirements

### Requirement: Private password recovery

The system SHALL respond identically to password recovery requests for existing and unknown account identifiers, without revealing account existence through the response status or message.

#### Scenario: Recovery requested for an existing account

- **WHEN** a visitor submits a username or email address belonging to an account
- **THEN** the system responds with the generic recovery acknowledgement
- **AND** it sends a password reset email when delivery is available

#### Scenario: Recovery requested for an unknown account

- **WHEN** a visitor submits a username or email address belonging to no account
- **THEN** the system responds with the same status and generic recovery acknowledgement

### Requirement: Single-use password reset

The system SHALL update the password and consume a reset token as one conditional database operation, only while the token is valid and unexpired.

#### Scenario: Member resets their password

- **WHEN** a member submits matching new passwords with a valid, unexpired reset token
- **THEN** the system updates the password and consumes the token atomically
- **AND** the member is signed in in the browser that completed the reset
- **AND** sessions from before the reset are invalidated

- **WHEN** the same reset token is submitted again or concurrently after it has been consumed
- **THEN** the system rejects the reset

### Requirement: Account-wide session revocation after password change

The system SHALL invalidate all sessions created before a password reset, authenticated password change, or actual administrative role change, while allowing the current browser to continue in a newly established session after a password reset or change. A role request that leaves the roles unchanged SHALL NOT revoke sessions.

#### Scenario: Member changes their password

- **WHEN** a signed-in member changes their password with their current password
- **THEN** the system signs that browser into a new session
- **AND** sessions in other browsers require sign-in again

#### Scenario: An administrator changes a member's roles

- **WHEN** an administrator adds or removes a member role
- **THEN** the system increments that member's authentication version with the role update
- **AND** sessions created before the role change require sign-in again

#### Scenario: An administrator repeats a role request with no effect

- **WHEN** an administrator submits a role request that leaves the member's roles unchanged
- **THEN** the system does not increment the authentication version
- **AND** existing sessions remain valid

#### Scenario: A pre-deployment session uses the legacy ID-only format

- **WHEN** a member presents a session that stores only their account ID
- **THEN** the system rejects that session and requires sign-in again

#### Scenario: A member's account is deleted

- **WHEN** a member's account is deleted while they have an active session
- **THEN** the system cannot deserialize that session to an account
- **AND** member-only routes require sign-in
