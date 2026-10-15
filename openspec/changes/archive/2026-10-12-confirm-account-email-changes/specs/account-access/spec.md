## ADDED Requirements

### Requirement: Credential-confirmed account email changes

The system SHALL require fresh confirmation of the member's current password before staging a different account email. If the account uses MFA, it SHALL also require and atomically consume an existing second-factor proof. Confirmation SHALL be bound to the member, session, proposed change and current authentication version.

#### Scenario: Member requests an email change

- **WHEN** a signed-in member supplies a different valid email and valid current credentials
- **THEN** the server stages the proposed email without changing the current email
- **AND** it sends a confirmation to the proposed address and a notification to the current address

#### Scenario: Confirmation is absent or stale

- **WHEN** credential confirmation is missing, invalid or belongs to an earlier authentication version
- **THEN** the pending and current email addresses remain unchanged

### Requirement: Pending email change lifecycle

The system SHALL let a member review and cancel their pending email change. It SHALL apply only the currently pending change when its dedicated valid token is consumed atomically.

#### Scenario: Pending change is cancelled or replaced

- **WHEN** a member cancels or replaces a pending change
- **THEN** previously issued confirmation tokens cannot apply that change

#### Scenario: Cancellation races with a replacement

- **WHEN** a pending address or its token changes after a cancellation request
  was authenticated
- **THEN** cancellation returns a retry response and leaves the replacement
  pending address unchanged

#### Scenario: Current change is confirmed

- **WHEN** the current pending address is confirmed with its valid token
- **THEN** the system updates the email once and clears the pending change
- **AND** increments the authentication version to invalidate older sessions
- **AND** preserves a verified MFA session only when it was already verified
