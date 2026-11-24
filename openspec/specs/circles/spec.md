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
at desktop and mobile widths. The circle wiki action SHALL appear after any
member discovery content. Circle detail pages SHALL display the shared site
footer with its standard links and current build metadata.

#### Scenario: Member uses circle page actions on a narrow viewport

- **WHEN** a member views a circle on a mobile viewport
- **THEN** the membership, member search, and circle wiki actions remain visible and usable
- **AND** the shared footer links and build metadata wrap without horizontal overflow

#### Scenario: Joined member views the circle wiki action

- **WHEN** a joined member views a circle page
- **THEN** the circle wiki action follows the member discovery groups

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

The system SHALL present circle contacts, recommenders and other active members using the shared member-search card, with coarse activity bands and links to the approximate hosting map for eligible current hosting offers. The endpoint SHALL keep exact activity timestamps and hosting coordinates out of its response.

#### Scenario: Member discovers people in a circle

- **WHEN** an authenticated circle member views contacts, recommenders or other active members
- **THEN** each person is presented with the shared member-search-card visuals and available profile details
- **AND** available activity is shown in coarse bands
- **AND** a current visible hosting offer links to its approximate location on the member's profile

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
public page. Public circle pages SHALL link to the administrator editor for users with the
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
- **THEN** its administrator edit link is visible to users with the admin role

### Requirement: Circle organisers

The system SHALL show linked organiser names on the web circle detail page to signed-in members who can view the circle and the listed profiles. The organiser designation SHALL be independent of circle membership.

#### Scenario: Signed-in member views a circle with organisers

- **WHEN** a signed-in member opens a circle with eligible organisers
- **THEN** the circle page shows the organisers' current names linked to their profiles
- **AND** joining or leaving the circle preserves the organiser section

#### Scenario: Organisers are unavailable to the viewer

- **WHEN** a guest opens a circle or a signed-in viewer has no eligible organisers to see
- **THEN** the page omits the organiser section
- **AND** the detail API omits organiser identities the viewer cannot access

#### Scenario: Organiser identities are scoped to circle details

- **WHEN** a client requests the circle catalogue or a circle membership payload
- **THEN** the response excludes organiser assignments

### Requirement: Circle join reason

A member joining a circle on the web SHALL be able to provide an optional reason of up to 160 characters on a single line. The system SHALL attach the reason to that membership and remove it when the member leaves.

The profile Circles tab SHALL show the reason to signed-in members who can view the profile.

#### Scenario: Member joins with a reason

- **WHEN** a member enters a valid reason and joins a circle
- **THEN** the system saves the reason on the new membership

#### Scenario: Member joins without a reason

- **WHEN** a member leaves the reason blank or joins from a client without the reason field
- **THEN** the system creates the membership without a reason

#### Scenario: Member leaves a circle

- **WHEN** a member leaves a circle
- **THEN** the membership and its join reason are removed

#### Scenario: Signed-in member views a profile

- **WHEN** a signed-in member opens the Circles tab of a profile they can access
- **THEN** the tab displays saved join reasons alongside their circles

#### Scenario: Guest requests a profile

- **WHEN** a guest requests profile data
- **THEN** the system excludes join reasons

### Requirement: Android circle detail join reason

An Android member joining from circle detail SHALL be able to provide an optional reason of up to 160 characters on a single line. The field SHALL explain who can read the reason.

#### Scenario: Android member enters a reason

- **WHEN** a member enters a reason on Android circle detail and taps Join circle
- **THEN** the app submits the trimmed reason with the membership request

#### Scenario: Android member leaves the reason blank

- **WHEN** a member taps Join circle with the reason blank
- **THEN** the app submits the membership request without a reason

### Requirement: Accessible circle discovery states

Circle discovery SHALL present loading, successful empty and failed request
states with a clear heading and screen-specific explanation. Loading and
outcome states SHALL use existing platform status semantics. A failed request
SHALL provide an accessible action that retries the request. A successful
empty result SHALL NOT be presented as a request failure.

#### Scenario: Circle member discovery returns no members

- **WHEN** circle member discovery succeeds with no members
- **THEN** the screen presents its empty explanation as a status and does not
  show an error or retry action

### Requirement: Automatic links in circle descriptions

Circle pages and description previews SHALL turn plain web addresses into links while preserving supported formatting and existing safe links.

#### Scenario: A description contains a bare domain

- **WHEN** a reader opens a circle whose description contains a bare domain
- **THEN** the address is a clickable HTTPS link

### Requirement: Organiser circle editing

The system SHALL let eligible signed-in organisers edit the name and description of a visible circle to which they are currently assigned. The system SHALL keep the circle URL stable and reserve other catalogue controls for administrators.

#### Scenario: An assigned organiser edits their circle

- **WHEN** an assigned organiser opens their circle and saves a valid name and description
- **THEN** the updated details are visible at the same circle URL

#### Scenario: A member lacks an active assignment

- **WHEN** a member attempts to edit a circle without a current organiser assignment
- **THEN** the system denies the update

### Requirement: Markdown links in web circle descriptions

The web circle description and its editor previews SHALL render inline Markdown
links of the form `[label](https://example.org/)` with HTTP or HTTPS
destinations. Existing safe HTML links SHALL remain supported.

#### Scenario: Administrator adds a Markdown link

- **WHEN** an administrator enters a labelled Markdown link with a valid HTTP
  or HTTPS destination
- **THEN** the admin preview shows the link with its label
- **AND** the public circle page shows the same link after saving

#### Scenario: A Markdown link uses an unsupported destination

- **WHEN** a Markdown link has a destination using another scheme
- **THEN** the editor previews and public circle page render it as text

### Requirement: Circle catalogue filtering and sections

The catalogue SHALL offer a text filter above its cards and display circles
marked new in a dedicated section before other circles. Each circle SHALL
appear once, in its corresponding section.

#### Scenario: Visitor filters available circles

- **WHEN** a visitor enters text in the catalogue filter
- **THEN** the catalogue displays only available circles whose names or slugs contain the text, ignoring casing and surrounding whitespace
- **AND** headings for sections without matches are omitted
- **AND** the catalogue explains when there are no matches

#### Scenario: Visitor clears the filter

- **WHEN** a visitor clears the catalogue filter
- **THEN** all available catalogue entries return
- **AND** circles marked new appear above the other circles
