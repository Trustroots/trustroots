## ADDED Requirements

### Requirement: iOS selected Community Notes use a shared card

The regular iOS map SHALL show the selected Community Note in shared Compose
with its original text, a preview of up to four lines, the native-formatted
source attribution and an accessible Dismiss action. The iOS host SHALL handle
note selection and size the card to its content.

#### Scenario: Read a selected Community Note

- **GIVEN** a member selects a Community Note marker
- **WHEN** the note card appears
- **THEN** the shared card shows the note and its publication date
- **AND** selecting Dismiss clears the existing map selection
