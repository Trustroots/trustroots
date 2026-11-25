## ADDED Requirements

### Requirement: Regular iOS profile uses shared Experiences presentation

The regular iOS profile SHALL render public Experience statistics, feedback
and available responses using Compose. It SHALL show up to six cards by default,
allow expansion and collapse, and use the existing profile route for authors
and respondents with usernames.

#### Scenario: Read a member's published experiences

- **GIVEN** a regular iOS profile has public Experience feedback and a public response
- **WHEN** a member visits the Experiences section
- **THEN** they see the summary and both published texts
- **AND** selecting an author opens their native profile
