## MODIFIED Requirements

### Requirement: Circle discovery

The system SHALL make public circle catalogue entries, public circle details,
and circle-backed member discovery available to visitors and members. It SHALL
make configured member-only circles available only to signed-in members.

#### Scenario: Visitor opens the circle catalogue

- **WHEN** a visitor opens the circles page
- **THEN** the system displays available public circles
- **AND** member-only circles are omitted

#### Scenario: Visitor opens a circle detail page

- **WHEN** a visitor opens an available public circle detail page
- **THEN** the system displays that circle's information

#### Scenario: Visitor opens the Naturists circle

- **WHEN** a visitor requests the Naturists circle page or detail API
- **THEN** the system requires authentication
- **AND** does not disclose the circle's information

#### Scenario: Member opens the Naturists circle

- **WHEN** a signed-in member requests the Naturists circle page or detail API
- **THEN** the system displays that circle's information
