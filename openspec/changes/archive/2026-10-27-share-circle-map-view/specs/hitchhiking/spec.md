## ADDED Requirements

### Requirement: Shared circle map view

The hackers and hitchhikers circle maps SHALL restore the centre and zoom chosen on either map during the same browser session. When no view has been chosen, a map SHALL fit its initial results as before.

#### Scenario: Visitor switches circle maps

- **WHEN** a visitor pans or zooms one circle map and opens the other circle map in the same browser session
- **THEN** the other map shows the chosen centre and zoom
- **AND** incoming results do not reset that view
