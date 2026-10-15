## ADDED Requirements

### Requirement: Hosting editor tab links

The hosting editor SHALL support `#availability`, `#description` and `#location`.
Tab selection SHALL update the fragment and browser history navigation SHALL
restore the selected tab. Empty or unknown fragments SHALL show Availability.
Location SHALL remain accessible before the description is complete.

#### Scenario: Open the location editor directly

- **WHEN** a member opens `/offer/host#location`
- **THEN** the Location tab and hosting location editor are visible

#### Scenario: Navigate tab history

- **WHEN** a member changes tabs and uses browser Back or Forward
- **THEN** the tab matches the URL fragment without losing unsaved edits

### Requirement: Profile hosting map

Visible active hosting offers SHALL show a compact map using the shared offer
map renderer and API-supplied location. Offers without a valid location or with
status no SHALL omit the map. Existing profile visibility rules SHALL apply.

#### Scenario: View a hosting member's accommodation

- **WHEN** a member views a visible offer with status yes or maybe and a location
- **THEN** a compact map shows the offer's approximate hosting area
