## MODIFIED Requirements

### Requirement: Native Android message alerts

The Android app SHALL let signed-in members opt in to unread-message alerts
through UnifiedPush. It SHALL request notification permission when required,
register only the current account's device, and remove that registration on
opt-out or sign-out. Tapping an alert SHALL open the relevant conversation.
The app SHALL remain usable without a distributor.

#### Scenario: Member enables alerts on a Play Services phone

- **WHEN** a signed-in member enables alerts in a release build with Google Play Services and no external distributor
- **THEN** the app requests notification permission when required
- **AND** registers the bundled distributor's endpoint for that member without a picker or separate app installation

#### Scenario: Member enables alerts

- **WHEN** a signed-in member enables alerts and an external distributor is available
- **THEN** the app requests notification permission when required
- **AND** helps the member use an external distributor and registers its endpoint for that member

#### Scenario: Member changes account on one device

- **WHEN** a member signs out and another member signs in on the same device
- **THEN** the previous member's registration is removed
- **AND** the new member is not registered until they opt in

#### Scenario: Member taps an unread-message alert

- **WHEN** the member taps an Android unread-message alert
- **THEN** the app opens the matching conversation after checking their session

#### Scenario: No distributor is installed

- **WHEN** neither an external distributor nor the bundled distributor is available
- **THEN** the app explains that external UnifiedPush setup is required and email reminders remain available
- **AND** native messaging remains usable

## ADDED Requirements

### Requirement: Message alert opt-in from the inbox

The Android inbox SHALL offer signed-in members a dismissible action to enable
message alerts. The Account settings control SHALL remain available.

#### Scenario: Member opts in from Messages

- **WHEN** a member selects the inbox action to enable message alerts
- **THEN** the app requests Android notification permission when required
- **AND** initiates enrolment once permission is granted

#### Scenario: Member dismisses the inbox action

- **WHEN** a member dismisses the inbox alert prompt
- **THEN** the Account settings control remains available for later enrolment
