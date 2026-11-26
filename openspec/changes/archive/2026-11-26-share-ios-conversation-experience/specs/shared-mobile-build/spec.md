## ADDED Requirements

### Requirement: Regular iOS conversations use a shared Experience form

The regular iOS conversation SHALL present Experience interaction choices,
recommendation and optional public feedback in Compose. Sharing SHALL require at
least one interaction. The native iOS host SHALL present and dismiss the sheet
and submit through the existing authenticated Experience API. A failed request
SHALL keep the entered choices and feedback available for manual retry.

#### Scenario: Retry sharing an Experience in a conversation

- **GIVEN** a signed-in member can share an Experience from a regular iOS conversation
- **WHEN** they choose an interaction and recommendation and the request fails
- **THEN** the form displays the error and preserves the form values
- **AND** a successful manual retry dismisses the sheet and updates the conversation action
