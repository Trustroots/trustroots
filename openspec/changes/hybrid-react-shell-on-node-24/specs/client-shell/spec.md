## ADDED Requirements

### Requirement: Dual client shells

The system SHALL provide separate Webpack client entries for the Angular
application (`main`) and the React application (`react-main`) while both shells
are in use.

#### Scenario: Angular-owned path loads the Angular bundle

- **WHEN** a visitor requests a path that is not React-owned
- **THEN** the server renders the Angular document shell
- **AND** the page loads the `main` client assets

#### Scenario: React-owned path loads the React bundle

- **WHEN** a visitor requests a React-owned path
- **THEN** the server renders the React document shell
- **AND** the page loads the `react-main` client assets

### Requirement: React route ownership

The system SHALL determine React ownership from a shared route policy list that
includes public informational pages and administration paths.

#### Scenario: Public FAQ is React-owned

- **WHEN** a visitor opens `/faq`
- **THEN** the request is served through the React shell

#### Scenario: Administration home requires an admin role

- **WHEN** a signed-in member without the admin role opens `/admin`
- **THEN** the system redirects them away from the administration interface

#### Scenario: Administrator opens administration home

- **WHEN** an authorised administrator opens `/admin`
- **THEN** the React shell renders the administration interface

### Requirement: Cross-shell navigation hand-off

The system SHALL force a full navigation when an Angular-page link targets a
React-owned path so the React shell loads.

#### Scenario: Angular page links to a React-owned path

- **WHEN** a member activates a same-origin link to a React-owned path from an
  Angular page
- **THEN** the browser performs a full navigation to that path
- **AND** the React shell becomes the active client
