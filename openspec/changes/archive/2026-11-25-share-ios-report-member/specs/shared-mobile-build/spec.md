## ADDED Requirements

### Requirement: Regular iOS member reporting uses shared action presentation

The regular iOS report sheet SHALL use shared Compose for the target, send
action, and error and success presentation. It SHALL preserve the native
report editor, keyboard Done action, authenticated report request and sheet
dismissal. A blank report SHALL be ineligible to send.

#### Scenario: Retry a member report

- **GIVEN** a signed-in member has written a report about another member
- **WHEN** the support request fails
- **THEN** the sheet shows the error and preserves the report text
- **AND** after a successful retry it confirms delivery and allows the reporter to close the sheet

#### Scenario: Cancel a member report

- **GIVEN** a member has opened the report sheet and a send is not in progress
- **WHEN** they choose Cancel
- **THEN** the app dismisses the sheet and returns to the member profile
