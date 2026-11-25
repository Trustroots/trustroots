## ADDED Requirements

### Requirement: Regular iOS Account uses shared password actions

The regular iOS Account screen SHALL use Compose for the Change password
and recovery actions and their feedback. It SHALL preserve Swift secure fields,
the existing authenticated password update and the bounded recovery browser route.
The action SHALL be available when all three password fields contain values
and no password change is in progress.

#### Scenario: Change a password from Account

- **GIVEN** a signed-in member has completed the native password fields
- **WHEN** they use the Compose Change password action
- **THEN** the app submits the request with the existing iOS password client
- **AND** it shows a returned error or clears the fields and confirms success

#### Scenario: Open password recovery from Account

- **GIVEN** a member is viewing the password section
- **WHEN** they choose to recover their password
- **THEN** the app opens the existing iOS recovery route
