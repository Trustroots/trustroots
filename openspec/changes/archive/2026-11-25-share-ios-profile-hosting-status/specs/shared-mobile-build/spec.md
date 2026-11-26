## ADDED Requirements

### Requirement: Regular iOS profile uses shared hosting summary

The regular iOS profile SHALL present the member's hosting status, available
description and guest capacity in Compose. Meeting availability SHALL be shown
independently of hosting, while volunteering and capacity SHALL follow the
active hosting offer.

#### Scenario: Show meeting availability without active hosting

- **GIVEN** a regular iOS profile has a meeting status and no active offer
- **WHEN** the viewer reads the hosting summary
- **THEN** they see both the meeting availability and inactive hosting status
