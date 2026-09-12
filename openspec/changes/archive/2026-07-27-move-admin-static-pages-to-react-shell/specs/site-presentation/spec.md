## ADDED Requirements

### Requirement: Incremental React page shell

The system SHALL render administration and read-only public pages with the
React application shell while retaining the Angular application for
stateful member workflows during the transition.

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

- **WHEN** a visitor opens a profile, circle, search, offer, message, or authentication route
- **THEN** the server continues to render the Angular application root and assets

#### Scenario: Visitor opens the legacy about route

- **WHEN** a visitor opens `/about`
- **THEN** the React shell preserves the existing redirect to the homepage
