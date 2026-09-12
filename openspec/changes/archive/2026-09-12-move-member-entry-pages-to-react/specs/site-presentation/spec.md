## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Incremental React page shell

The system SHALL render administration, read-only public pages and member
entry pages with the React application shell while retaining Angular for
the remaining member workflows during the transition.

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

- **WHEN** a visitor opens a profile, circle, offer search, offer, message, or authentication route
- **THEN** the server continues to render the Angular application root and assets

#### Scenario: Visitor opens the legacy about route

- **WHEN** a visitor opens `/about`
- **THEN** the React shell preserves the existing redirect to the homepage
