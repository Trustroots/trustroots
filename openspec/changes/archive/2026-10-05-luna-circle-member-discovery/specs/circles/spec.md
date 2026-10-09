## ADDED Requirements

### Requirement: Circle member discovery

The system SHALL provide signed-in members who belong to a circle with a bounded discovery view containing their eligible contacts in that circle, members of that circle who recommend them, and other eligible circle members active in the last month.

#### Scenario: Joined member discovers circle members

- **WHEN** a signed-in member opens a circle they belong to
- **THEN** eligible contacts in that circle appear first
- **AND** eligible members who recommend them appear next
- **AND** other eligible circle members active in the last month appear after them
- **AND** a person appears in at most one section
- **AND** suspended accounts and profiles hidden from the viewer are omitted
- **AND** each section returns a bounded number of members

#### Scenario: Visitor or non-member views a circle

- **WHEN** a visitor or a signed-in non-member opens a circle
- **THEN** the member discovery sections are not shown

### Requirement: Circle page controls and shared footer

Circle detail pages SHALL present membership state, member search, and circle wiki actions as a cohesive responsive group and SHALL include the shared site footer with available build metadata.

#### Scenario: Member views circle actions

- **WHEN** a member opens a circle detail page on a narrow or wide viewport
- **THEN** membership state, member search, and circle wiki actions remain usable and visually grouped

#### Scenario: Circle detail footer is rendered

- **WHEN** a visitor or member opens a circle detail page
- **THEN** the shared site footer links and current build metadata are rendered when available
