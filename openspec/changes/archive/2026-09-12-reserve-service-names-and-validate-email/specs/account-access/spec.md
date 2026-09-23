## ADDED Requirements

### Requirement: Service usernames remain reserved

New accounts and username changes SHALL reject the configured reserved names, including organisation, support, application-route and Nostr names. Existing members with reserved usernames SHALL be prevented from saving unrelated profile changes while retaining their reserved username.

#### Scenario: A new member selects a reserved service name

- **WHEN** a signup uses a configured reserved name
- **THEN** the account is not created

#### Scenario: An existing member retains a newly reserved name

- **WHEN** a member saves an unrelated profile change without changing their username
- **THEN** the save is rejected and the profile remains unchanged

### Requirement: Pending email addresses are valid

Pending email addresses SHALL pass the existing email validator or be empty when no confirmation is pending. Profile email changes SHALL reject malformed addresses and non-string values before processing the change.

#### Scenario: A member submits a malformed email change

- **WHEN** a member submits an invalid email address or a non-string value
- **THEN** the request returns a validation error without changing the stored email

#### Scenario: No email confirmation is pending

- **WHEN** an account has an empty pending email address
- **THEN** email validation allows the account to be saved
