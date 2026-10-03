# Member Notifications Specification

## MODIFIED Requirements

### Requirement: Push notifications are retired

The system SHALL reject legacy browser, Expo, and Firebase push registrations
and SHALL NOT deliver through those retired transports. Historical
registration records MAY remain on member profiles and SHALL remain removable.
The system MAY accept authenticated Android UnifiedPush registrations for
native unread-message alerts when Web Push is configured. Email notifications
SHALL remain available regardless of Android push status.

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

### Requirement: Native Android unread-message alerts

When configured, the server SHALL send a generic encrypted Android alert for
the first unread-message reminder in an eligible conversation. The displayed
alert SHALL contain no message text or member identity; its encrypted delivery
payload MAY contain the sender ID for navigation. Restricted or shadow-hidden
messages SHALL NOT cause an alert. A push failure SHALL NOT stop the email
reminder.

#### Scenario: Visible conversation remains unread

- **WHEN** the first unread-message reminder is due for a visible conversation
- **AND** the recipient has an active UnifiedPush registration
- **THEN** the server sends one generic alert to each active Android device

#### Scenario: Restricted sender has hidden message

- **WHEN** a restricted member sends a shadow-hidden message
- **THEN** the recipient receives no Android alert for it

#### Scenario: Web Push delivery fails

- **WHEN** a distributor endpoint cannot receive an Android alert
- **THEN** the email reminder continues under its existing rules
