## ADDED Requirements

### Requirement: Navigation-scoped Android discovery state

The Android HostMap and MemberSearch screens SHALL expose immutable UI state
from separate screen ViewModels and SHALL send user and viewport actions as
explicit events. Each ViewModel SHALL be obtained from the active Search visit's
Navigation 3-owned store through an injectable repository boundary. The map
state SHALL retain its filters, visible offers, place search state and camera
coordinates/zoom. The member-search state SHALL retain its query, submitted
results and search status. These states SHALL remain available while the Search
visit is retained off-screen and across Activity recreation. Neither ViewModel
nor its saveable navigation state SHALL persist a session, cookie, API client or
credential. Removing the authenticated Search visit SHALL cancel its work and
clear its account-owned state.

#### Scenario: Member changes Search mode

- **WHEN** a member switches from HostMap to MemberSearch or back within one
  Search visit
- **THEN** the visible screen uses its existing ViewModel state
- **AND** the other mode retains its query or filters, results, camera and
  active request state

#### Scenario: Member temporarily leaves Search

- **WHEN** a member navigates to another top-level tab while the Search visit
  remains on the Navigation 3 back stack
- **THEN** returning to Search restores its HostMap and MemberSearch state
- **AND** successful data is not reloaded solely because Search was temporarily
  off-screen

#### Scenario: Activity recreates during discovery

- **WHEN** Android recreates the Activity while a member uses Search
- **THEN** the Search entry's ViewModels retain the member query/results,
  map filters and camera position/zoom
- **AND** any still-current request remains observed or safely restarts without
  displaying an obsolete result
- **AND** no cookie or session credential appears in restored state or route
  keys

#### Scenario: Member explicitly reselects Search

- **WHEN** a member reselects the active Search tab
- **THEN** Navigation 3 returns to the Search map root without adding a shell
  history visit
- **AND** the member query, results, searched/error state and in-flight request
  are cleared
- **AND** the map returns to its existing default camera and filters, clears
  place text, suggestions and old results, and performs a fresh visible-area
  search

#### Scenario: Obsolete member or map request completes

- **WHEN** a newer query, filter, viewport, place lookup, explicit reset or
  entry removal supersedes an earlier request
- **THEN** the earlier response does not replace current results, loading or
  error state, move the map, or restore obsolete suggestions

#### Scenario: Place suggestions or location lookup fails

- **WHEN** a place query is too short, returns no match or fails
- **THEN** the map retains its existing viewport and visible offers
- **AND** a late response for a previous query does not change the camera or
  show an obsolete error

#### Scenario: Discovery request reports an expired session

- **WHEN** a member search, map search, host-context or circle-membership
  request reports an authentication failure
- **THEN** the ViewModel emits one identified session-invalidation event
- **AND** the existing shell callback is delivered once and acknowledges the
  event
- **AND** the removed Search entry cancels outstanding work and closes its live
  community-note source

#### Scenario: A different account opens Search

- **WHEN** a member signs out or their session expires and another account
  opens Search
- **THEN** the prior Search entry and ViewModels are cleared
- **AND** the new account starts with default map state and an empty member
  search

#### Scenario: Member returns from a child discovery destination

- **WHEN** a member opens a host or member profile from Search and returns with
  Back
- **THEN** the same Search visit restores the map camera, active filters,
  results, member query and result list position that preceded the child
  destination
