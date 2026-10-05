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

### Requirement: Circle member discovery

The system SHALL let signed-in members discover visible people in circles they
have joined. Groups SHALL list contacts first, then recommenders, then other
members active in the preceding month. Results SHALL be unique and bounded per
group. The endpoint SHALL return public profile summaries without activity
timestamps.

#### Scenario: Joined member views a circle

- **WHEN** a signed-in member opens a circle they have joined
- **THEN** the page shows their visible contacts in that circle
- **AND** shows visible members who publicly recommend them
- **AND** shows other visible members of that circle active in the past month
- **AND** removes duplicate members across the groups

#### Scenario: Member requests discovery for a circle they have not joined

- **WHEN** a signed-in member requests its member discovery endpoint
- **THEN** the system denies the request

#### Scenario: Circle discovery excludes private or restricted accounts

- **WHEN** circle member groups are generated
- **THEN** hidden profiles, blocked members, suspended accounts, and shadow-hidden accounts are omitted
- **AND** each group limit is applied only after these exclusions

### Requirement: Circle page actions and footer

The system SHALL keep membership, member search, and circle wiki actions usable
at desktop and mobile widths. Circle detail pages SHALL display the shared site
footer with its standard links and current build metadata.

#### Scenario: Member uses circle page actions on a narrow viewport

- **WHEN** a member views a circle on a mobile viewport
- **THEN** the membership, member search, and circle wiki actions remain visible and usable
- **AND** the shared footer links and build metadata wrap without horizontal overflow

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
