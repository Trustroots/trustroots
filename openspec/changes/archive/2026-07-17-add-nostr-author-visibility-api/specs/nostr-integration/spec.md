## MODIFIED Requirements

### Requirement: Community-note discovery

The system SHALL let signed-in members enable a persistent Community Notes
filter on the search map and read the associated Nostroots thread for a
selected location. The map SHALL exclude notes authored by members who are not
eligible for public display.

#### Scenario: Member enables Community Notes

- **WHEN** a signed-in member enables the Community Notes search filter
- **THEN** the map displays available community-note locations from eligible
  authors
- **AND** excludes notes from shadowbanned, suspended, private, and unknown
  authors
- **AND** the filter remains enabled after the member reloads the page

#### Scenario: Member selects a community-note location

- **WHEN** a member selects a community-note location
- **THEN** the system displays the location's note thread and available author
  information
- **AND** a reply action opens the Nostroots action options
