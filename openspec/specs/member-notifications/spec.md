# member-notifications Specification

## Purpose

TBD - created by archiving change retire-mobile-push. Update Purpose after archive.

## Requirements

### Requirement: Retired mobile push integrations

The system SHALL reject new registrations for retired mobile push platforms while
preserving browser registrations and existing profile data.

#### Scenario: Retired mobile client registers a token

- **WHEN** a client submits an Android, iOS or Expo push registration
- **THEN** the API rejects the registration without storing or scheduling it

#### Scenario: Member retains historical mobile registrations

- **WHEN** a member saves a profile containing historical mobile registrations
- **THEN** the profile remains valid
- **AND** existing registrations can still be removed

#### Scenario: Browser registers notifications

- **WHEN** a browser submits a valid web push registration
- **THEN** the existing registration behaviour is preserved
- **AND** push delivery remains disabled pending a separate browser-push decision
