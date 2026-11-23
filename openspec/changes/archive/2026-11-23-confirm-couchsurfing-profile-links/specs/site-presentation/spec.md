## MODIFIED Requirements

### Requirement: Dedicated profile network exceptions

Outbound destinations in a web profile’s Elsewhere section SHALL open in a new tab using `target="_blank"` and `rel="noopener noreferrer"`. Only a signed-in member with their own saved Couchsurfing handle SHALL be offered a Couchsurfing destination from a profile entry or the profile editor. Both entry points SHALL show a warning and require confirmation before opening the destination in a new tab.

#### Scenario: View hospitality networks

- **WHEN** a visitor follows an outbound profile network link other than Couchsurfing
- **THEN** that destination opens in a new tab and the Trustroots profile stays open

#### Scenario: Identify a network on desktop

- **WHEN** a visitor hovers over an Elsewhere profile entry on desktop
- **THEN** the full network name appears as a hover label

#### Scenario: Confirm a Couchsurfing destination

- **WHEN** a signed-in member with a saved Couchsurfing handle selects a Couchsurfing profile entry or tests their handle in the profile editor
- **THEN** a warning offers the choice to cancel or to open the Couchsurfing profile in a new tab
- **AND** dismissing the warning opens no tab

#### Scenario: View Couchsurfing without a saved handle

- **WHEN** a visitor has no saved Couchsurfing handle of their own
- **THEN** a displayed Couchsurfing profile handle remains plain text and the editor offers no Couchsurfing Test action
