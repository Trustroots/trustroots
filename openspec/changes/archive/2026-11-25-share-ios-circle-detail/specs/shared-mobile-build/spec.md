## ADDED Requirements

### Requirement: Regular iOS Circle details use Compose

The regular iOS Circle detail SHALL show the Circle summary and member
discovery in Compose using the existing iOS artwork and member cache. It SHALL
show loading, empty and unavailable states, offer retry when a request fails,
and use the existing member profile and Wiki routes.

#### Scenario: Discover members and return to Circles

- **GIVEN** a signed-in member opens a Circle with discoverable members
- **WHEN** they select a member profile and return to the detail
- **THEN** the Circle details and discovered members are available again
- **AND** returning to Circles preserves their existing list filter
