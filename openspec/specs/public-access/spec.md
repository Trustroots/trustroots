# Public Access Specification

## Purpose

Allow visitors to discover Trustroots, read public information, and begin using
the service without an existing account.

## Requirements

### Requirement: Homepage access

The system SHALL make the Trustroots homepage available without authentication
and present entry points for signing in and creating an account.

#### Scenario: Visitor opens the homepage

- **WHEN** a visitor opens the homepage
- **THEN** the Trustroots homepage is displayed
- **AND** sign-in and sign-up entry points are available

### Requirement: Public information and circles

The system SHALL make its public information pages and circle catalogue
available without authentication.

#### Scenario: Visitor browses circles

- **WHEN** a visitor opens the circles page
- **THEN** a list of available circles is displayed

#### Scenario: Visitor opens a public information page

- **WHEN** a visitor opens a supported public information page
- **THEN** the requested page is displayed without requiring authentication

### Requirement: Unknown-route response

The system SHALL show a user-facing not-found page when a visitor requests an
unknown browser route.

#### Scenario: Visitor opens an unknown route

- **WHEN** a visitor opens a route that is not provided by the application
- **THEN** the visitor is shown the not-found page
