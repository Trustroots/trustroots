## ADDED Requirements

### Requirement: Development serves the React shell with Vite

The default development command SHALL serve the current React shell with Vite
and SHALL tell Express to load that development client. The production build
command SHALL continue to build the client with Webpack. A Webpack development
command SHALL remain available and SHALL NOT select the Vite client.

#### Scenario: Developer starts the app

- **WHEN** a developer runs the default start command
- **THEN** Vite serves the client and proxies other requests to Express
- **AND** Express renders the Vite development scripts

#### Scenario: Production client build

- **WHEN** the production build command runs
- **THEN** it builds the client with Webpack

#### Scenario: Webpack development fallback

- **WHEN** a developer runs the Webpack start command
- **THEN** the Webpack development server serves the client
- **AND** Express does not render the Vite development scripts
