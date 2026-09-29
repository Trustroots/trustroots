## ADDED Requirements

### Requirement: In-memory route permissions

The application SHALL authorise protected routes using the configured
in-memory grants for role, route pattern and HTTP method without requiring
external database-backed ACL packages.

#### Scenario: A role has permission for a route and method

- **WHEN** a request has any role granted its route pattern and HTTP method
- **THEN** the route policy permits the request

#### Scenario: A role has wildcard permission

- **WHEN** a role has wildcard permission for a route pattern
- **THEN** the route policy permits each HTTP method for that route

#### Scenario: No role has permission

- **WHEN** none of a request's roles has permission for its route and method
- **THEN** the route policy denies the request
