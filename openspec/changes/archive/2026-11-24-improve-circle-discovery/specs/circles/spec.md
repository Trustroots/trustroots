## ADDED Requirements

### Requirement: Circle catalogue filtering and sections

The catalogue SHALL offer a text filter above its cards and display circles
marked new in a dedicated section before other circles. Each circle SHALL
appear once, in its corresponding section.

#### Scenario: Visitor filters available circles

- **WHEN** a visitor enters text in the catalogue filter
- **THEN** the catalogue displays only available circles whose names or slugs contain the text, ignoring casing and surrounding whitespace
- **AND** headings for sections without matches are omitted
- **AND** the catalogue explains when there are no matches

#### Scenario: Visitor clears the filter

- **WHEN** a visitor clears the catalogue filter
- **THEN** all available catalogue entries return
- **AND** circles marked new appear above the other circles

## MODIFIED Requirements

### Requirement: Circle page actions and footer

The system SHALL keep membership, member search, and circle wiki actions usable
at desktop and mobile widths. The circle wiki action SHALL appear after any
member discovery content. Circle detail pages SHALL display the shared site
footer with its standard links and current build metadata.

#### Scenario: Member uses circle page actions on a narrow viewport

- **WHEN** a member views a circle on a mobile viewport
- **THEN** the membership, member search, and circle wiki actions remain visible and usable
- **AND** the shared footer links and build metadata wrap without horizontal overflow

#### Scenario: Joined member views the circle wiki action

- **WHEN** a joined member views a circle page
- **THEN** the circle wiki action follows the member discovery groups
