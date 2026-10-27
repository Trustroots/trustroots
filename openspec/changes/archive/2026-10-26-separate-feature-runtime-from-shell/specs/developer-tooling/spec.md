## ADDED Requirements

### Requirement: Feature runtime interfaces are independent of shell composition

Feature production modules SHALL obtain bootstrap settings/context hooks and the browser navigation primitive from core-owned implementations without importing `layers/shell`. The shell SHALL compose those interfaces with authentication and query providers while owning window bootstrap reading, routing and layout.

Current repository consumers and tooling references SHALL import implementation owners directly. Obsolete core-to-shell re-export files SHALL be removed after their consumers are migrated. State identity, navigation behaviour, client coverage and existing browser journeys SHALL be preserved.

#### Scenario: Feature consumes application settings

- **WHEN** a feature reads settings or application configuration through a core hook inside the shell provider tree
- **THEN** it observes the same bootstrap context and authentication/query state across rerenders
- **AND** its production imports do not reach the shell

#### Scenario: Feature navigates through the client runtime

- **WHEN** a feature requests same-origin navigation through the core client runtime
- **THEN** the core browser-navigation primitive preserves history and popstate behaviour
- **AND** the shell remains responsible for selecting and rendering the route

## MODIFIED Requirements

### Requirement: Client route table sits outside feature modules

The client route table SHALL live outside `modules/*`. Composing a feature page into that table SHALL NOT add a module-graph link from `core` to that feature. Repository callers SHALL import route helpers directly from the shell owner; the obsolete core route-table re-export SHALL be removed once its callers have been migrated.

#### Scenario: Feature page is added to the route table

- **WHEN** the shell route table imports a page from a feature module
- **THEN** the module-graph baseline does not gain a link from `core` to that feature

#### Scenario: Existing caller imports the previous path

- **WHEN** an existing repository caller of the previous core route-helper path is migrated
- **THEN** they reference `layers/shell/client/routes` directly
- **AND** no production module needs to import that composition layer
