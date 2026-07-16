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
show an empty state when no members match.

#### Scenario: Member searches for an available member

- **WHEN** a signed-in member searches using another available member's details
- **THEN** the system displays matching member results

#### Scenario: Member search has no matches

- **WHEN** a signed-in member searches with no matching members
- **THEN** the system displays a no-results state

### Requirement: Hosting offers

The system SHALL let a member create, update, list, and remove their hosting
offer.

#### Scenario: Member creates or updates a hosting offer

- **WHEN** a member saves valid hosting-offer details
- **THEN** the system makes the updated hosting offer available in the member's offer list and search results

#### Scenario: Member removes a hosting offer

- **WHEN** a member removes or disables their hosting offer
- **THEN** the offer is no longer available as an active hosting offer

### Requirement: Meeting offers

The system SHALL let a member create, edit, list, expire, and delete their
meeting offers.

#### Scenario: Member manages a meeting offer

- **WHEN** a member creates or edits a valid meeting offer
- **THEN** the system saves the offer and displays it in the member's meeting-offer list

#### Scenario: Meeting offer reaches its expiry

- **WHEN** a meeting offer reaches its expiry conditions
- **THEN** the system no longer presents it as an active meeting offer

### Requirement: Legacy offer routes

The system SHALL direct legacy offer-parent routes to their current
equivalents.

#### Scenario: Visitor opens a legacy offer-parent route

- **WHEN** a visitor opens a supported legacy offer-parent route
- **THEN** the system redirects them to the corresponding current offer route
