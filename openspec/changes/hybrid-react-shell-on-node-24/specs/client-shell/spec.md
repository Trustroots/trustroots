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

### Requirement: React single-page navigation

After the Angular cutover, the system SHALL use TanStack Router to match and
render React-owned routes and to navigate between same-origin routes without
reloading the browser document. It SHALL update the browser URL and history
while preserving native browser behaviour for links that are external,
downloaded, targeted at another browsing context, activated with modifier keys,
or contain a fragment.

#### Scenario: Visitor follows an internal application link

- **WHEN** a visitor activates an ordinary link from one React-owned route to
  another React-owned route
- **THEN** the React shell updates the URL and rendered route
- **AND** the current browser document remains loaded

#### Scenario: Internal navigation changes query parameters

- **WHEN** internal navigation changes the query string on a React-owned route
- **THEN** the React shell observes the new URL
- **AND** the affected route renders from the updated query parameters without
  reloading the browser document

#### Scenario: Visitor uses browser history

- **WHEN** a visitor moves backwards or forwards through React-owned route
  history
- **THEN** the React shell renders the route represented by that history entry
- **AND** the current browser document remains loaded

#### Scenario: Link requires native browser behaviour

- **WHEN** a visitor activates an external, downloaded, targeted,
  modifier-assisted, or fragment link
- **THEN** the application does not replace the browser's native link
  behaviour

### Requirement: React 18 application root

The React client SHALL run on React 18 and mount through the `createRoot` API.

#### Scenario: React shell starts

- **WHEN** the browser document is ready
- **THEN** the application creates a React 18 root in the React shell element
- **AND** TanStack Router renders the route represented by the current URL

### Requirement: Shared route ownership

The browser router and server-side document-shell selection SHALL derive their
matches and path parameters from the same route policy definitions using
TanStack routing semantics.

#### Scenario: Dynamic profile route is requested

- **WHEN** a member opens `/profile/example-member`
- **THEN** the server selects the React document shell
- **AND** the client router renders the profile route with `example-member` as
  the username parameter
