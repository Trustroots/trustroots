## ADDED Requirements

### Requirement: Client route table sits outside feature modules

The client route table SHALL live outside `modules/*`. Composing a feature page into that table SHALL NOT add a module-graph link from `core` to that feature. Existing imports of the previous core route module SHALL keep working through a re-export.

#### Scenario: Feature page is added to the route table

- **WHEN** the shell route table imports a page from a feature module
- **THEN** the module-graph baseline does not gain a link from `core` to that feature

#### Scenario: Existing caller imports the previous path

- **WHEN** client code imports the route helpers from `modules/core/client/react-app/routes`
- **THEN** those helpers resolve to the shell route table
