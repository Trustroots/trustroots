# Circles Specification

## Purpose

Help people discover Trustroots circles and manage their circle memberships.

## Requirements

### Requirement: Circle discovery

The system SHALL make public circle catalogue entries, public circle details,
and circle-backed member discovery available to visitors and members. It SHALL
make configured member-only circles available only to signed-in members.

#### Scenario: Visitor opens the circle catalogue

- **WHEN** a visitor opens the circles page
- **THEN** the system displays available public circles
- **AND** member-only circles are omitted

#### Scenario: Visitor opens a circle detail page

- **WHEN** a visitor opens an available public circle detail page
- **THEN** the system displays that circle's information

#### Scenario: Visitor opens the Naturists circle

- **WHEN** a visitor requests the Naturists circle page or detail API
- **THEN** the system requires authentication
- **AND** does not disclose the circle's information

#### Scenario: Member opens the Naturists circle

- **WHEN** a signed-in member requests the Naturists circle page or detail API
- **THEN** the system displays that circle's information

### Requirement: Circle membership

The system SHALL let signed-in members join and leave circles, and reflect
their memberships in circle and profile views.

#### Scenario: Member joins a circle

- **WHEN** a signed-in member joins an available circle
- **THEN** the system records the membership and shows the member as joined

#### Scenario: Member leaves a circle

- **WHEN** a signed-in member leaves a joined circle
- **THEN** the system removes the membership from the member's profile and circle list

### Requirement: Circle-aware registration and legacy routes

The system SHALL support circle suggestions during registration and redirect
supported legacy tribe routes to their circle equivalents.

#### Scenario: Visitor begins registration from a circle suggestion

- **WHEN** a visitor follows a registration link with a circle suggestion
- **THEN** the sign-up experience presents that circle as a suggestion

#### Scenario: Visitor opens a legacy tribe route

- **WHEN** a visitor opens a supported legacy tribe route
- **THEN** the system redirects them to the corresponding circle route
