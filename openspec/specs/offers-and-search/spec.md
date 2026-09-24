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
