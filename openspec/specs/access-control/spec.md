# access-control Specification

## Purpose

Protect server routes with per-route role permissions declared in each
module's policy while preserving the application's existing access decisions.

## Requirements

### Requirement: Per-route permissions

Each module policy SHALL declare, for every route pattern it protects, the
HTTP methods each role may call, and one shared check SHALL enforce those
declarations without registering grants at startup or requiring external
ACL packages. Requests without a signed-in user are checked as `guest`.

#### Scenario: A role has permission for a route and method

- **WHEN** a request has any role granted its route pattern and HTTP method
- **THEN** the route policy permits the request

#### Scenario: No role has permission

- **WHEN** none of a request's roles has permission for its route and method
- **THEN** the route policy denies the request
