# Account Access Specification

## Purpose

Allow people to create, secure, recover, and end access to their Trustroots
account.

## Requirements

### Requirement: Account registration

The system SHALL allow a person to create an account with valid, unique
registration details and SHALL explain invalid or unavailable details.

#### Scenario: Person creates an account

- **WHEN** a person submits valid and unique registration details
- **THEN** the system creates their account

#### Scenario: Person submits unavailable registration details

- **WHEN** a person submits a username or email address that cannot be used
- **THEN** the system reports that the registration details are invalid or unavailable

### Requirement: Sign-in and protected access

The system SHALL let account holders sign in using either their username or
email address, and SHALL require sign-in for member-only routes.

#### Scenario: Account holder signs in with an email address

- **WHEN** an account holder submits valid email-address credentials
- **THEN** the system signs them in and opens their member experience

#### Scenario: Visitor opens a member-only route

- **WHEN** a signed-out visitor opens a member-only route
- **THEN** the system directs them to sign in

#### Scenario: Person submits invalid credentials

- **WHEN** a person submits invalid sign-in credentials
- **THEN** the system shows an error and keeps them on the sign-in page

### Requirement: Account confirmation and recovery

The system SHALL let account holders confirm their email address and recover
access through valid password-reset details.

#### Scenario: Account holder confirms their email address

- **WHEN** an account holder submits a valid email-confirmation token
- **THEN** the system makes their profile public

#### Scenario: Account holder resets their password

- **WHEN** an account holder submits a valid password-reset token and matching new passwords
- **THEN** the system updates their password
- **AND** the account holder can sign in with the new password

### Requirement: Sign-out

The system SHALL end an account holder's session when they sign out.

#### Scenario: Account holder signs out

- **WHEN** an account holder signs out
- **THEN** the system clears their session
- **AND** member-only routes require them to sign in again
