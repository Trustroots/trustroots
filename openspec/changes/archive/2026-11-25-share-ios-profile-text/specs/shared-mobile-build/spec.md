## ADDED Requirements

### Requirement: Regular iOS profile uses shared biography and language sections

The regular iOS profile SHALL use Compose to display a member's biography
and language names when present. The existing iOS profile scroll view SHALL
accommodate the full text at the current width and text size. The language
section SHALL use the existing language catalogue and preserve when its title
is shown.

#### Scenario: Read a member's biography and languages

- **GIVEN** a member opens a regular iOS profile with a biography and spoken languages
- **WHEN** they scroll through the profile
- **THEN** they can read the full plain-text biography and the resolved language names
