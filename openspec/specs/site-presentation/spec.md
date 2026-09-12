# Site Presentation Specification

## Purpose

Present consistent site navigation, media resources, and deployed-code
information across Trustroots pages.

## Requirements

### Requirement: Shared site footer

The system SHALL provide a consistent footer across the main site and
administration interface, including its core information and safety links and
applicable photo credits.

#### Scenario: Visitor views a page with the shared footer

- **WHEN** a visitor views a page that displays the shared footer
- **THEN** the footer provides links to volunteering, rules, safety, FAQ,
  privacy, and contact information
- **AND** displays applicable photo credits

#### Scenario: Administrator views the administration footer

- **WHEN** an authorised administrator views an administration page
- **THEN** the administration footer uses the shared footer presentation

### Requirement: Deployed-code provenance

The system SHALL display available deployed-code provenance in the footer,
including a link to the source commit and its deployment timestamp.

#### Scenario: Build metadata is available

- **WHEN** a page is rendered with valid build metadata
- **THEN** the footer displays the commit timestamp and short commit identifier
- **AND** links to the corresponding source commit

#### Scenario: Production image has no Git checkout

- **WHEN** a production image is built without a Git checkout
- **THEN** build-time metadata remains available for the deployed-code footer link

### Requirement: Media resources

The system SHALL provide links from the media page to the current Trustroots
community media repository and its downloadable assets.

#### Scenario: Visitor opens a media resource

- **WHEN** a visitor selects a style guide, screenshot collection, media archive, or logo download on the media page
- **THEN** the selected resource resolves in the Trustroots community media repository

### Requirement: Incremental React page shell

The system SHALL render administration, read-only public pages, circle pages
and member entry pages with the React application shell while retaining
Angular for the remaining member workflows during the transition.

#### Scenario: Visitor opens a React-owned public page

- **WHEN** a visitor directly opens statistics, support/contact, FAQ, or a read-only informational page
- **THEN** the server renders the React application root and React assets
- **AND** the requested page retains its existing visible content and title

#### Scenario: Administrator opens an administration page

- **WHEN** an authorised administrator directly opens an administration page
- **THEN** the server renders the React application root and admin footer
- **AND** the React client renders the requested administration component

#### Scenario: Guest opens an administration page

- **WHEN** a guest directly opens an administration page
- **THEN** the server redirects the guest to sign in

#### Scenario: Non-admin member opens an administration page

- **WHEN** an authenticated member without the admin role directly opens an administration page
- **THEN** the server redirects the member to the volunteering page

#### Scenario: Visitor opens an Angular-owned member workflow

- **WHEN** a visitor opens a profile, offer search, offer, message, or authentication route
- **THEN** the server continues to render the Angular application root and assets

#### Scenario: Visitor opens a circle page

- **WHEN** a visitor opens the catalogue or an accessible circle detail page
- **THEN** the server renders the React application root and assets

#### Scenario: Visitor opens the legacy about route

- **WHEN** a visitor opens `/about`
- **THEN** the React shell preserves the existing redirect to the homepage

### Requirement: React homepage and information pages

The system SHALL render `/`, `/about` and `/safety` through the existing React application shell and preserve circle landing queries, guest signup links, photo credits and existing page content.

#### Scenario: Visitor opens a migrated page

- **WHEN** an eligible visitor opens a migrated route
- **THEN** the server renders the React root and assets
- **AND** the page retains its existing content and access rules

#### Scenario: Visitor continues to another workflow

- **WHEN** the visitor follows an onward link or completes a page action
- **THEN** the existing API behaviour and destination remain available
- **AND** Angular-owned destinations load their own application root

### Requirement: React member entry pages

The system SHALL render welcome, navigation and member search using the
existing React application shell while preserving their member-only access
and links into other application workflows.

#### Scenario: Member opens an entry page

- **WHEN** a signed-in member opens `/welcome`, `/navigation` or `/search/members`
- **THEN** the page uses the React root and assets
- **AND** its existing content, title and footer visibility are preserved

#### Scenario: Guest opens an entry page

- **WHEN** a guest opens one of the member entry pages
- **THEN** the guest is redirected to sign in

#### Scenario: Member searches from a link

- **WHEN** a member opens `/search/members?search=sample`
- **THEN** the search field and results use the supplied query
- **AND** result links open the existing profile workflow

#### Scenario: Member leaves an entry page

- **WHEN** a member follows a link to an Angular-owned workflow
- **THEN** the destination loads its application root
- **AND** signing out from navigation ends the authenticated session

### Requirement: React contact confirmation

The system SHALL render `/contact-confirm/:contactId` through the existing React application shell and preserve member-only access, recipient checks, missing or confirmed requests and confirmation submission.

#### Scenario: Visitor opens a migrated page

- **WHEN** an eligible visitor opens a migrated route
- **THEN** the server renders the React root and assets
- **AND** the page retains its existing content and access rules

#### Scenario: Visitor continues to another workflow

- **WHEN** the visitor follows an onward link or completes a page action
- **THEN** the existing API behaviour and destination remain available
- **AND** Angular-owned destinations load their own application root
