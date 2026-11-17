## ADDED Requirements

### Requirement: Discoverable Android map filters and area results

Android map search SHALL initially show its filters in wrapping rows without horizontal scrolling, retain the six-month last-active default, and let members collapse and reopen filters without changing their selections. Members SHALL be able to switch between the map and an offers list for its current area. Entering Results SHALL collapse its filter controls independently of the map, and returning to the map SHALL restore its previous filter visibility. The offers list and its return navigation SHALL remain usable at 320dp width with 130% text, without map-only statistics consuming the results viewport. List entries SHALL show available member identity and availability, open the existing offer details and preserve the map viewport, filters and list position on return. Loading, empty and recoverable failure states SHALL remain understandable. Offer details SHALL load only for visible list entries with bounded concurrency and SHALL NOT survive a change of member session.

#### Scenario: Member opens and collapses map filters

- **WHEN** a member opens a new map search
- **THEN** hosting, meeting, activity, circles and language controls are visible without horizontal scrolling
- **AND** last active defaults to six months
- **AND** collapsing and reopening controls retains the selections

#### Scenario: Member inspects a current-area list result

- **WHEN** a member opens Results and selects an offer in the visible map area
- **THEN** the existing host or meeting detail opens
- **AND** returning restores the list and its position with the same viewport and filters
- **AND** returning to the map preserves its viewport

#### Scenario: Current-area results are empty or unavailable

- **WHEN** the current map search has no offers or an offer detail request fails
- **THEN** the list shows an empty state or a retry action for the failed entry
- **AND** an authentication failure invokes existing session invalidation

#### Scenario: Member uses Results with a narrow viewport and larger text

- **WHEN** a member opens Results at 320dp width with 130% text
- **THEN** an offer and the Back to map action remain visible and operable
- **AND** the member can explicitly reopen the result filters
- **AND** selecting an offer and returning preserves the results
- **AND** Back to map restores the map's previous filter expansion state and selections
