## MODIFIED Requirements

### Requirement: Circle member cards

The system SHALL present circle contacts, recommenders and other active members using the shared member-search card, with coarse activity bands and links to the approximate hosting map for eligible current hosting offers. The endpoint SHALL keep exact activity timestamps and hosting coordinates out of its response.

#### Scenario: Member discovers people in a circle

- **WHEN** an authenticated circle member views contacts, recommenders or other active members
- **THEN** each person is presented with the shared member-search-card visuals and available profile details
- **AND** available activity is shown in coarse bands
- **AND** a current visible hosting offer links to its approximate location on the member's profile
