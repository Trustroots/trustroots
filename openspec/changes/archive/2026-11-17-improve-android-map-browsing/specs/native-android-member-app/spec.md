## ADDED Requirements

### Requirement: Discoverable Android map filters and area results

Android map search SHALL initially show its filters in wrapping rows without horizontal scrolling, retain the six-month last-active default, and let members collapse and reopen filters without changing their selections. Members SHALL be able to switch between the map and an offers list for its current area. List entries SHALL show available member identity and availability, open the existing offer details and preserve the map viewport, filters and list position on return. Loading, empty and recoverable failure states SHALL remain understandable. Offer details SHALL load only for visible list entries with bounded concurrency and SHALL NOT survive a change of member session.

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
