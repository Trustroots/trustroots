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

### Requirement: React circle pages

The system SHALL render the circle catalogue and individual circle pages with
the existing React application shell, preserving circle access and membership
behaviour on the current supported runtime.

#### Scenario: Visitor opens circle pages

- **WHEN** a visitor opens `/circles` or an available public circle detail
- **THEN** the server selects the React root and assets
- **AND** the page displays the circle catalogue or requested circle

#### Scenario: Visitor opens a member-only circle

- **WHEN** a signed-out visitor opens a member-only circle
- **THEN** the page redirects to sign in without rendering that circle's details
- **AND** the detail API continues to require authentication

#### Scenario: Member changes a membership

- **WHEN** a member joins or leaves a circle through either circle page
- **THEN** membership state and the circle count update
- **AND** the member's current application permissions are retained

#### Scenario: Member follows a circle link into another workflow

- **WHEN** a member opens a profile, search or registration link from a circle
- **THEN** the destination loads through its existing application root

#### Scenario: A circle description contains unsupported markup

- **WHEN** a circle description is displayed
- **THEN** supported text formatting and links are preserved
- **AND** unsupported markup is omitted
