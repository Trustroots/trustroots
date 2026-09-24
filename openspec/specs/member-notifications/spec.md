## Purpose

Defines member notification behaviour after push delivery was retired. Email
notifications remain the active channel; push can be rebuilt later.

## Requirements

### Requirement: Push notifications are retired

The system SHALL not accept new push registrations or deliver push
notifications. Historical registration records MAY remain on member profiles
and SHALL remain removable. Email notifications remain unchanged.

#### Scenario: New push registration is rejected

- **WHEN** a client submits any push registration
- **THEN** the API rejects the registration without storing it

#### Scenario: Historical registrations can be removed

- **WHEN** a member requests removal of an existing push registration token
- **THEN** that token is removed from the profile when present

#### Scenario: Profile save keeps historical registration data

- **WHEN** a member saves a profile that still contains historical push
  registrations
- **THEN** the profile remains valid
- **AND** no push delivery is scheduled
