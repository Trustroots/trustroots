## ADDED Requirements

### Requirement: Regular iOS profile uses shared member actions

The regular iOS profile SHALL render applicable edit, hosting, message,
report and block controls in Compose. The iOS host SHALL own navigation,
confirmation and authenticated block requests. A blocked member SHALL
remain unavailable for messaging until unblocked.

#### Scenario: Block and unblock a member

- **GIVEN** a signed-in member opens another member's profile
- **WHEN** they confirm Block
- **THEN** the profile offers Unblock and hides its message action
- **AND** confirming Unblock restores the message action
