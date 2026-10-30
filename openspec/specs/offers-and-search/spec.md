# Offers and Search Specification

## Purpose

Help members find community offers and manage their own hosting and meeting
offers.

## Requirements

### Requirement: Map search

The system SHALL let signed-in members search for offers on a map by location,
map bounds, and circle membership.

#### Scenario: Member searches within a map area

- **WHEN** a signed-in member searches within a map area
- **THEN** the system displays matching offers in that area

#### Scenario: Member filters map results by circle

- **WHEN** a signed-in member applies a circle filter
- **THEN** the system displays offers matching that circle

### Requirement: Map result navigation

The system SHALL let members open a selected offer from a map deep link and
continue using the map when no offers are available.

#### Scenario: Member opens an offer deep link

- **WHEN** a member opens a search link for an available offer
- **THEN** the system displays that offer in the search results sidebar

#### Scenario: Map area has no offers

- **WHEN** a member searches an area with no matching offers
- **THEN** the search map remains usable and explains the empty result state

### Requirement: Member search

The system SHALL let signed-in members search for other available members and
show an empty state when no members match. Suspended and shadowbanned members
are not available to regular member search.

#### Scenario: Member searches for an available member

- **WHEN** a signed-in member searches using another available member's details
- **THEN** the system displays matching member results

#### Scenario: Member searches for a restricted member

- **WHEN** a signed-in member searches using a suspended or shadowbanned
  member's details
- **THEN** the system displays a no-results state

#### Scenario: Member search has no matches

- **WHEN** a signed-in member searches with no matching members
- **THEN** the system displays a no-results state

### Requirement: Hosting offers

The system SHALL let a member create, update, list, and remove their hosting offer. A newly created offer SHALL require an explicitly selected location.

#### Scenario: Member creates or updates a hosting offer

- **WHEN** a member saves valid hosting-offer details
- **THEN** the system makes the updated hosting offer available in the member's offer list and search results

#### Scenario: Member removes a hosting offer

- **WHEN** a member removes or disables their hosting offer
- **THEN** the offer is no longer available as an active hosting offer

#### Scenario: Member creates a hosting offer without choosing a location

- **WHEN** a member completes other hosting details but has not chosen a location
- **THEN** the editor does not save the map's default coordinates as their offer location
- **AND** the server rejects a new offer at those coordinates

#### Scenario: Member cannot host and has no selected location

- **WHEN** a member selects that they cannot host while creating an offer
- **THEN** the editor explains that a location is still required before saving
- **AND** the Location tab remains available

### Requirement: Meeting offers

The system SHALL let a member create, edit, list, expire, and delete their meeting offers. A newly created offer SHALL require an explicitly selected location.

#### Scenario: Member manages a meeting offer

- **WHEN** a member creates or edits a valid meeting offer
- **THEN** the system saves the offer and displays it in the member's meeting-offer list

#### Scenario: Meeting offer reaches its expiry

- **WHEN** a meeting offer reaches its expiry conditions
- **THEN** the system no longer presents it as an active meeting offer

#### Scenario: Member creates a meeting offer without choosing a location

- **WHEN** a member completes other meeting details but has not chosen a location
- **THEN** the editor does not save the map's default coordinates as their offer location
- **AND** the server rejects a new offer at those coordinates

### Requirement: Legacy offer routes

The system SHALL direct legacy offer-parent routes to their current
equivalents.

#### Scenario: Visitor opens a legacy offer-parent route

- **WHEN** a visitor opens a supported legacy offer-parent route
- **THEN** the system redirects them to the corresponding current offer route

### Requirement: Welcome team location correction

The system SHALL let welcome team members review active offers whose actual stored location matches the map's default coordinates or lies within the nearby area. It SHALL distinguish exact and nearby matches and group offers by member.

#### Scenario: Welcome team reviews candidates

- **WHEN** a welcome team member opens the location correction queue
- **THEN** they see eligible members with uncontacted exact and nearby offers, without changing those offers or sending messages

#### Scenario: Welcome team contacts a member

- **WHEN** a welcome team member reviews a candidate and sends an editable correction message
- **THEN** the member receives one ordinary Trustroots message from that team member and the reviewed offer locations are marked contacted

#### Scenario: Send is retried

- **WHEN** the same contact request is retried or another team member acts on the same unchanged offer locations
- **THEN** no duplicate correction message is created

#### Scenario: Offer location changes

- **WHEN** a contacted offer's stored location changes while remaining in the nearby area
- **THEN** it can be reviewed again at the new location

#### Scenario: Another offer expires

- **WHEN** a member's meeting offer expires after their current offer locations were contacted
- **THEN** their unchanged active offers do not reappear in the correction queue

#### Scenario: Unauthorised access

- **WHEN** a member without the welcome team or admin role requests the queue or contact endpoint
- **THEN** access is denied

### Requirement: Discover members through indexed public profile fields

Authenticated members SHALL be able to reach member search from map search and search names, usernames, home locations, origins and short taglines using a weighted text index. Queries SHALL have bounded length, result count, pagination and execution time. Existing profile visibility and mutual blocking rules SHALL apply.

#### Scenario: Find a member by home location

- **WHEN** an authenticated member submits a home-location query of at least three characters
- **THEN** eligible matching members are returned in relevance order with a bounded result count
- **AND** cards display public location and profile context with literal matching text emphasised in bold

#### Scenario: Reach member search from the map

- **WHEN** a member follows the visible member-search link from map search
- **THEN** the member-search page opens with its search input focused

#### Scenario: Reject excessive search input

- **WHEN** a query exceeds the supported length or is not a scalar string
- **THEN** the request is rejected before a database search

#### Scenario: Return to map search from member results

- **WHEN** a member follows the map-search link from member results
- **THEN** the map-search page opens with the query supplied as its location search
- **AND** the link is also available when no members match

### Requirement: Visible map results list

The system SHALL show a list of available offers and enabled community Nostr note threads whose pins are within the current map viewport when a member opens the Results pane. The list SHALL honour the map's content filters and author visibility rules.

#### Scenario: Open Results with visible offers

- **WHEN** a member opens Results while offer pins are visible on the map
- **THEN** the pane lists those offers with their member and offer details
- **AND** offers outside the current viewport are omitted

#### Scenario: Select a listed offer

- **WHEN** a member selects an offer from the Results list
- **THEN** the pane displays that offer's details
- **AND** the map retains its current viewport

#### Scenario: List visible community notes

- **WHEN** a member opens Results with community notes enabled and visible on the map
- **THEN** the pane lists the visible note threads grouped by their map location
- **AND** notes excluded by author visibility rules or outside the viewport are omitted

#### Scenario: Select a listed community note

- **WHEN** a member selects a community note thread from Results
- **THEN** the pane displays the existing thread view
- **AND** the map retains its current viewport

#### Scenario: Disable community notes

- **WHEN** a member disables community notes in the map content filters
- **THEN** community note threads are removed from Results

#### Scenario: Return to results

- **WHEN** a member returns from selected offer or community note details to Results
- **THEN** the pane shows the results for the current map viewport
- **AND** the map retains its current viewport

#### Scenario: Select a map pin

- **WHEN** a member selects an offer pin on the map
- **THEN** the pane displays that offer's details

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

### Requirement: Approximate initial map viewport

The system SHALL initialise fresh search, hosting and meeting maps using an
approximate IP-derived viewport when no higher-priority location applies.
Search SHALL prefer explicit destinations over a recent saved search viewport,
then GeoIP, then the existing default. Offer editors SHALL prefer existing
offer coordinates over GeoIP, then the existing default, and SHALL NOT inherit
the saved search viewport. GeoIP SHALL only centre the viewport and SHALL NOT
select or save an offer location.

#### Scenario: Member opens a fresh search map

- **WHEN** a member opens search without an explicit destination or recent saved viewport
- **AND** an approximate location is available
- **THEN** the map starts at that approximate viewport
- **AND** no browser geolocation permission is requested

#### Scenario: Member opens an explicit destination

- **WHEN** a member opens an explicit search location, bounds or offer deep link
- **THEN** the map uses that destination regardless of saved or IP-derived locations

#### Scenario: Member edits an existing offer

- **WHEN** a member opens an offer with saved coordinates
- **THEN** the editor shows those coordinates regardless of GeoIP or search history

#### Scenario: Member creates an offer

- **WHEN** a member opens a new hosting or meeting editor and GeoIP is available
- **THEN** its initial viewport uses the approximate location without choosing a marker
- **AND** the member must explicitly select a location before saving
- **AND** initialisation, zoom-only events and programmatic moves do not select a location

#### Scenario: Member acts before lookup completes

- **WHEN** a member searches, pans, zooms or selects a location before the GeoIP response arrives
- **THEN** the response does not move the map or change the selected offer location

#### Scenario: Lookup is unavailable

- **WHEN** the database is disabled, missing or unusable, the address has no usable result, or the request fails
- **THEN** the map remains usable with its next applicable fallback

### Requirement: Recent saved search viewport

The system SHALL restore a valid saved search viewport only when it was changed
by the member less than 48 hours ago. Only deliberate member viewport changes
SHALL refresh its timestamp. Invalid or legacy untimestamped records SHALL be
treated as absent. Storage failures SHALL NOT prevent map use.

#### Scenario: Member returns within 48 hours

- **WHEN** a member returns to search without an explicit destination and has a valid recent saved viewport
- **THEN** the map restores that viewport in preference to GeoIP
- **AND** restoration alone does not refresh its timestamp

#### Scenario: Saved viewport expires or cannot be trusted

- **WHEN** a saved viewport is at least 48 hours old, future-dated, malformed or untimestamped
- **THEN** it is ignored and cleared where storage is available
- **AND** the map uses GeoIP or the existing default

#### Scenario: Storage is unavailable

- **WHEN** browser storage cannot be read or written
- **THEN** the member can still use and navigate the map

### Requirement: Local and isolated approximate location lookup

The system SHALL resolve the current authenticated request's trusted client
address using a locally provisioned database. It SHALL NOT send visitor IPs to
an external lookup service or expose visitor-specific results through shared
application settings. Responses SHALL be private and non-cacheable and SHALL
contain only an approximate viewport or a null location. Approximate coordinates
SHALL be rounded to whole degrees, with zoom no greater than 6 and widened for
the reported accuracy radius. Invalid and non-public addresses SHALL yield no
location. GeoIP results SHALL NOT be stored in member or offer records.

#### Scenario: Separate members request defaults concurrently

- **WHEN** authenticated requests from different trusted client addresses overlap
- **THEN** each response contains only its own approximate location or null
- **AND** shared settings do not retain either location
- **AND** each response carries private/no-store cache controls

#### Scenario: Client supplies an ordinary forwarding header

- **WHEN** a request supplies an untrusted forwarding header
- **THEN** it does not override the address selected by the existing client-IP helper

#### Scenario: Database is not configured

- **WHEN** the application starts without a configured GeoIP database path
- **THEN** no database is loaded and authenticated lookup returns a null location
- **AND** application startup and map use continue normally

#### Scenario: Anonymous caller requests a default

- **WHEN** an unauthenticated caller requests the default-location endpoint
- **THEN** the existing API authentication policy rejects the request

### Requirement: Explicit web device location

The web client SHALL offer an accessible “Use my location” action on map search and shared hosting/meeting location editors. It SHALL request device location only after member activation, using a one-shot request with a 15-second timeout, no cached position and default accuracy. It SHALL prevent duplicate pending requests and ignore callbacks after unmount. Coordinates SHALL be finite and within latitude/longitude bounds, including valid zero values.

#### Scenario: Member centres search on their device

- **WHEN** a member activates the action and the browser returns valid coordinates
- **THEN** search centres on those coordinates at zoom 13 in either map renderer
- **AND** clears the previous place query, bounds and offer/community-note selection while preserving search filters
- **AND** uses existing search viewport persistence without publishing a member location

#### Scenario: Member selects an offer location using their device

- **WHEN** a member successfully activates the action in a hosting or meeting editor
- **THEN** the editor selects editable coordinates through its existing location-change flow
- **AND** persists them only when the member saves, retaining existing public-location randomisation

#### Scenario: Device location fails

- **WHEN** permission is denied, location is unavailable, the request times out, coordinates are invalid or the browser does not support geolocation
- **THEN** the action presents accessible, actionable feedback and permits retry
- **AND** manual place search and map selection remain available without changing the selected location

#### Scenario: Approximate defaults arrive after explicit navigation

- **WHEN** the member activates device location while a GeoIP lookup is pending
- **THEN** delayed approximate defaults do not override subsequent device-location navigation

#### Scenario: Member has not requested location

- **WHEN** the member opens search or an offer editor without activating the action
- **THEN** the client does not request browser geolocation or start location tracking

### Requirement: Map location controls and approximate fallback

Search, shared hosting/meeting editors, and hackers and hitchhikers circle maps SHALL offer an accessible location icon over the map. Activating it SHALL request device location once and, on failure, try the existing authenticated GeoIP lookup. A successful fallback SHALL clearly announce its approximate nature and use the returned coarse zoom. Pending requests SHALL be deduplicated and stale callbacks ignored.

#### Scenario: Device permission is denied

- **WHEN** the member activates the map icon and device location fails
- **THEN** an available GeoIP result centres the map at its approximate viewport
- **AND** search preserves filters and uses existing viewport persistence
- **AND** the control announces that the location is approximate

#### Scenario: Approximate offer editor navigation

- **WHEN** an offer editor receives an approximate fallback
- **THEN** only its viewport changes, including when an existing location is selected
- **AND** the selected offer coordinates remain unchanged until explicit manual or precise device selection
- **AND** saving remains explicit

#### Scenario: Neither source is available

- **WHEN** device location fails and GeoIP yields no location
- **THEN** actionable device-location feedback and manual navigation remain available

#### Scenario: Circle map relay results arrive late

- **WHEN** a member activates location while circle markers are loading
- **THEN** subsequent relay results do not replace the chosen viewport
