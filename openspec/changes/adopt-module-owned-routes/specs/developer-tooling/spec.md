## MODIFIED Requirements

### Requirement: Client route table sits outside feature modules

Feature modules SHALL own their client route definitions, declared in their own `client` source against the typed root route in `core`. The composed client route tree and the router's type registration SHALL live outside `modules/*`, in the shell composition layer. Composing a feature's routes into that tree SHALL NOT add a module-graph link from `core` to that feature, and `core` SHALL NOT import feature route definitions. Repository callers SHALL import route helpers directly from their owner; no compatibility re-export of a moved route helper SHALL remain once its callers have been migrated.

#### Scenario: Feature module declares a route

- **WHEN** a feature module declares a route with the core root route as its parent
- **THEN** the route definition lives in that module's `client` source
- **AND** the module-graph baseline does not gain a link from `core` to that feature

#### Scenario: Feature page is added to the route table

- **WHEN** the shell composition layer imports route definitions from feature modules to build the route tree
- **THEN** the module-graph baseline does not gain a link from `core` to those features
- **AND** no production module imports the composition layer

#### Scenario: Existing caller imports the previous path

- **WHEN** an existing repository caller of a route helper that moved to a new owner is migrated
- **THEN** it imports the helper from the new owner directly
- **AND** the previous path does not re-export it
