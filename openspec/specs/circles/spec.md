# Circles Specification

## Purpose

Help people discover Trustroots circles and manage their circle memberships.

## Requirements

### Requirement: Circle discovery

The system SHALL make the circle catalogue, circle details, and circle-backed
member discovery available to visitors and members.

#### Scenario: Visitor opens the circle catalogue

- **WHEN** a visitor opens the circles page
- **THEN** the system displays available circles

#### Scenario: Visitor opens a circle detail page

- **WHEN** a visitor opens an available circle detail page
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

### Requirement: Administrator circle catalogue management

The system SHALL let authorised administrators create and edit circle
catalogue records, including visibility, descriptive information, image
attribution, colour, and an optional image.

#### Scenario: Administrator creates a circle

- **WHEN** an authorised administrator submits a valid new circle
- **THEN** the system creates the circle with a generated public URL slug

#### Scenario: Administrator edits a circle

- **WHEN** an authorised administrator saves changes to an existing circle
- **THEN** the system updates the circle and preserves its member count

#### Scenario: Administrator uploads a circle image

- **WHEN** an authorised administrator uploads a valid circle image
- **THEN** the system generates the existing circle image sizes and JPG/WebP
  formats for the circle slug
