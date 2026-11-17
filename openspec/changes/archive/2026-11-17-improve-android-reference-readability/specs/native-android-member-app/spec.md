## ADDED Requirements

### Requirement: Readable Android profile experiences

Android profile experiences SHALL separate original feedback from its response using rounded surfaces and at least 16 dp of spacing. Responses SHALL have a bold heading naming the profile owner. Experiences SHALL show available guest and host interactions from the author’s perspective and recommendation text alongside sentiment colours, with a neutral treatment for unknown or absent recommendations. Existing author-profile actions and reference visibility SHALL remain unchanged.

#### Scenario: Member reads a hosting experience and response

- **WHEN** a profile experience includes guest or host interactions and a public response
- **THEN** its interaction labels identify the author’s role
- **AND** recommendation meaning is available in text without relying on colour
- **AND** the profile owner’s response appears below a bold named heading in a separate surface

#### Scenario: Older experience lacks recommendation or role data

- **WHEN** an experience lacks role or recommendation data
- **THEN** no hosting role is inferred and recommendation styling remains neutral
