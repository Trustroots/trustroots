## ADDED Requirements

### Requirement: Statistics experience context and encouragement

The statistics page SHALL explain that Trustroots did not have the experience
feature until 2021. When a signed-in member has an eligible experience
suggestion, the page SHALL encourage them to write about that contact and link
directly to the contact's experience form.

#### Scenario: Visitor views real-life connection statistics

- **WHEN** a visitor views the real-life connection statistics
- **THEN** the page explains that the experience feature was not available until 2021
- **AND** the page does not show a personalised contact suggestion

#### Scenario: Signed-in member has an eligible contact

- **WHEN** a signed-in member views the statistics page
- **AND** an eligible experience suggestion is available
- **THEN** the page encourages the member to write about the suggested contact
- **AND** the encouragement links to that contact's new-experience page

#### Scenario: Suggestion is unavailable

- **WHEN** a signed-in member has no eligible contact or the suggestion cannot be loaded
- **THEN** the page shows a general encouragement to share an experience from a member's profile
- **AND** the page does not expose a contact identity
