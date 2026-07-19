## MODIFIED Requirements

### Requirement: Community-note discovery

The system SHALL let signed-in members enable a persistent Community Notes
filter on the search map and read the associated Nostroots thread for a
selected location. The map SHALL fetch only original kind `30397` events and
SHALL NOT fetch kind `30398` validation-server events, so that current
Trustroots account visibility can be applied without depending on a stale
validation decision. It SHALL exclude notes authored by known Trustroots
members who are not eligible for public display while preserving notes from
valid Nostr authors who are not linked to a Trustroots account.

#### Scenario: Member enables Community Notes

- **WHEN** a signed-in member enables the Community Notes search filter
- **THEN** the map displays available original community-note locations from eligible and unlinked authors
- **AND** excludes notes from known shadowbanned, suspended, or private authors
- **AND** excludes notes with malformed author keys
- **AND** does not require validation-server copies of the original notes
- **AND** the filter remains enabled after the member reloads the page

#### Scenario: Member selects a community-note location

- **WHEN** a member selects a community-note location
- **THEN** the system displays the location's note thread and available author information
- **AND** a reply action opens the Nostroots action options

### Requirement: Profile community notes

The system SHALL show a Nostroots badge and recent original community notes on
a member profile when notes are available for that member's Nostr identity. It
SHALL fetch only kind `30397` events and SHALL NOT fetch kind `30398`
validation-server events.

#### Scenario: Member with community notes has their profile viewed

- **WHEN** a visitor views community notes associated with a member profile
- **THEN** the system fetches and displays only original kind `30397` events
- **AND** does not fetch kind `30398` validation-server copies
