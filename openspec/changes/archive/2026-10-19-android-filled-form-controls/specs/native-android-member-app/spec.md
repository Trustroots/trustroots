## ADDED Requirements

### Requirement: Consistent Android member form fields

Editable member forms and the conversation composer SHALL use Material 3 filled
text fields with consistent spacing between vertically adjacent fields. Field
labels and accessibility text SHALL come from Android string resources. The
presentation change SHALL preserve existing field values, validation, focus
and keyboard behaviour, disabled and loading states, and unsaved-change guards.
Search and filter inputs are outside this requirement.

#### Scenario: Member edits a form

- **WHEN** a member opens profile editing, hosting, experience or account
  fields
- **THEN** editable fields use the filled presentation and consistent vertical
  spacing
- **AND** labels remain accessible through Android string resources
- **AND** entering and saving values follows the existing validation and
  navigation behaviour

#### Scenario: Member writes a conversation message

- **WHEN** a member focuses the conversation composer and enters a message
- **THEN** the composer uses the filled presentation with an accessible label
- **AND** focus, keyboard and send behaviour remain unchanged

#### Scenario: Profile save fails

- **WHEN** saving an edited profile fails
- **THEN** the failure message remains visible independently of the form's
  scroll position
- **AND** the entered values remain available for another save attempt
