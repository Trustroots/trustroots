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

#### Scenario: Circle member discovery request fails

- **WHEN** the request to load circle members fails
- **THEN** the page explains that members could not be loaded and offers a retry
- **AND** does not present the failure as an empty member list
- **WHEN** the member retries and the request succeeds
- **THEN** the page displays the returned groups or the genuine empty state

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
- **THEN** supported text formatting and safe link destinations are preserved
- **AND** unsupported markup is omitted

### Requirement: Circle member cards

The system SHALL present circle contacts, recommenders and other active members using the same information-rich card presentation as member search, including available profile details.

#### Scenario: Member discovers people in a circle

- **WHEN** an authenticated circle member views contacts, recommenders or other active members
- **THEN** each person is presented with the shared member-search-card visuals and available profile details

### Requirement: Administrator circle catalogue management

The system SHALL let authorised administrators create and edit circle
catalogue records, including visibility, descriptive information, image
attribution, colour, and an optional image. A circle keeps the public URL slug
generated when it is created. Empty attribution fields are removed. A
description SHALL be at most 4000 characters. An uploaded image replaces the
public files only after every existing size and format has been generated, and
image updates for the same circle SHALL run one at a time. Hiding a circle
removes it from the public catalogue and leaves memberships in place. The
editor SHALL warn when a colour would make white labels hard to read. Existing
catalogue colours remain valid.

#### Scenario: Administrator creates a circle

- **WHEN** an authorised administrator submits a valid new circle
- **THEN** the system creates the circle with a generated public URL slug

#### Scenario: Administrator edits a circle

- **WHEN** an authorised administrator saves changes to an existing circle
- **THEN** the system updates the circle and preserves its member count and public URL slug

#### Scenario: Administrator clears image attribution

- **WHEN** an authorised administrator saves a circle with empty attribution fields
- **THEN** the system removes the stored attribution and attribution URL

#### Scenario: Administrator uploads a circle image

- **WHEN** an authorised administrator uploads a valid circle image
- **THEN** the system generates the existing circle image sizes and JPG/WebP
  formats for the circle slug
- **AND** replaces the public files only after every size has been generated
- **AND** does not interleave that replacement with another update of the same circle

### Requirement: Circle editor navigation and preview

The editor SHALL select a circle using `/admin/circles/{slug}` and link to its
public page. Public circle pages SHALL link to their editor for users with the
admin role. Circle descriptions SHALL preserve safe links, and the editor SHALL
show a sanitised live preview of the description.

#### Scenario: Administrator selects a circle

- **WHEN** an administrator selects a circle or directly opens its editor URL
- **THEN** the URL identifies that circle by slug and the editor loads it
- **AND** its public circle link is available

#### Scenario: Administrator edits a description

- **WHEN** the administrator changes description HTML
- **THEN** the editor previews safe formatting and link destinations
- **AND** unsupported markup and unsafe link destinations are removed

#### Scenario: Member views a circle

- **WHEN** a user views a circle
- **THEN** its edit link is visible only if the user has the admin role
