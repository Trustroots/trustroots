## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Test Android message alerts

Trustroots SHALL accept an authenticated test request only for a registration belonging to the caller. It SHALL rate-limit requests and schedule a generic test alert for that registration after 15 seconds, verifying ownership again at delivery.

#### Scenario: Test while the phone is locked

- **WHEN** a member requests a test on their registered device
- **THEN** the server schedules a push due in 15 seconds independently of whether the app stays open
