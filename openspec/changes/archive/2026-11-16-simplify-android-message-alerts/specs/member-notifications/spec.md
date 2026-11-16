## MODIFIED Requirements

### Requirement: Push notifications are retired

The system SHALL reject registrations through the retired browser, Expo, and
Firebase push interfaces and SHALL NOT deliver through their retired senders.
Historical registration records MAY remain on member profiles and SHALL remain
removable. When Web Push is configured, the system MAY accept authenticated
Android UnifiedPush registrations from external distributors and the bundled
distributor. Email notifications SHALL remain available regardless of Android
push status.

#### Scenario: New push registration is rejected

- **WHEN** a client submits a legacy push registration
- **THEN** the API rejects it without storing it

#### Scenario: Historical registrations can be removed

- **WHEN** a member requests removal of an existing historical registration
- **THEN** that registration is removed when present

#### Scenario: Profile save keeps historical registration data

- **WHEN** a member saves a profile that still contains historical push
  registrations
- **THEN** the profile remains valid
- **AND** no legacy push delivery is scheduled

#### Scenario: Native Android registration is replaced

- **WHEN** a signed-in member registers a UnifiedPush endpoint that was
  previously attached to another member
- **THEN** the endpoint is attached only to the current member

#### Scenario: Native Android registration is removed

- **WHEN** a signed-in member opts out or signs out of Android message alerts
- **THEN** the endpoint is removed from their registrations

#### Scenario: Bundled distributor registers an endpoint

- **WHEN** a signed-in member registers the bundled distributor's valid Web Push endpoint
- **THEN** the server accepts it when its host is allowlisted and Web Push is configured
