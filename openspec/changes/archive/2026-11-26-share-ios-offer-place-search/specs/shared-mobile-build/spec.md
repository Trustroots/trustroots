## ADDED Requirements

### Requirement: Regular iOS offer results use shared place-search controls

The iOS Results display SHALL render place entry, lookup failure and the
existing filter action in Compose. A nonblank submission SHALL use the native
place lookup and update the existing search region when found.

#### Scenario: Return to offer results with a place entered

- **GIVEN** a signed-in member has entered a place on the Results display
- **WHEN** they switch to Map and then return to Results
- **THEN** the entered place remains available for submission
- **AND** the Search filters action continues to open the existing filter sheet
