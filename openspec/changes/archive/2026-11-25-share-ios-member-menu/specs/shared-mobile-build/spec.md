## ADDED Requirements

### Requirement: Regular iOS Menu uses Compose

The regular iOS Menu SHALL use Compose to display its member actions,
support and website links, and the iOS build label. It SHALL invoke the
host’s existing navigation and bounded browser.

#### Scenario: Open a regular iOS menu item

- **GIVEN** a signed-in member opens Menu
- **WHEN** they select an account or member action
- **THEN** the corresponding existing iOS screen opens
- **AND** website links open in the bounded browser and can return to Menu
