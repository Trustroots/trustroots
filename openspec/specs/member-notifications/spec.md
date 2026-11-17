## Purpose

Defines member notification behaviour for email, retired legacy push, and
opt-in native Android message alerts.

## Requirements

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

### Requirement: Native Android unread-message alerts

When configured, Trustroots SHALL queue a generic encrypted UnifiedPush alert promptly after saving an eligible member message. Delivery SHALL recheck that the message is unread and visible to the recipient. Email reminders SHALL keep their existing schedule independently. The alert SHALL omit message text and sender identity from displayed content. Its encrypted payload MAY contain the sender ID for navigation.

#### Scenario: Visible conversation remains unread

- **WHEN** Trustroots saves an eligible message for a recipient with an active registration
- **THEN** Trustroots queues a push without waiting for the first email reminder
- **AND** the worker sends a generic alert to each active Android device if the message remains eligible

#### Scenario: A queued message has already been read

- **WHEN** the delivery worker finds that the message has been read or is no longer eligible
- **THEN** it skips the push

#### Scenario: Restricted sender has hidden message

- **WHEN** a restricted member sends a shadow-hidden message
- **THEN** the recipient receives no Android alert for it

#### Scenario: Web Push delivery fails

- **WHEN** a distributor endpoint cannot receive an Android alert
- **THEN** the email reminder continues under its existing rules

### Requirement: Test Android message alerts

Trustroots SHALL accept an authenticated test request only for a registration belonging to the caller. It SHALL rate-limit requests and schedule a generic test alert for that registration after 15 seconds, verifying ownership again at delivery.

#### Scenario: Test while the phone is locked

- **WHEN** a member requests a test on their registered device
- **THEN** the server schedules a push due in 15 seconds independently of whether the app stays open

### Requirement: Member-controlled optional emails

Members SHALL be able to choose the current unread-message email schedule, at most one digest per UTC day, at most one digest per UTC week, or no unread-message emails. Members SHALL be able to turn off hosting reminders independently. Existing accounts SHALL retain current delivery by default.

#### Scenario: Member chooses a digest

- **WHEN** eligible messages from multiple conversations remain unread for a digest recipient
- **THEN** the system sends at most one digest for the selected period grouping eligible conversations
- **AND** inbox delivery and push alerts continue independently

#### Scenario: Member follows an unsubscribe link

- **WHEN** the member confirms a valid unsubscribe link for an optional email category
- **THEN** the system disables that category for the link recipient
- **AND** other email preferences remain unchanged

#### Scenario: Member turns off a category before delivery

- **WHEN** a category is disabled before an optional email is delivered
- **THEN** the system skips that email
