# access-control Specification

## Purpose

Protect server routes using in-memory role permissions while preserving the
application's existing access decisions.

## Requirements

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

### Requirement: Multi-factor verification for privileged roles

Admin, moderator, and welcome-team access SHALL require an MFA-enabled account
and a session that has completed second-factor verification. Privileged routes
SHALL treat an unenrolled or unverified session as an ordinary member. A
privileged account that is not enrolled SHALL be restricted to authenticator
setup, sign-out, and necessary anonymous/authentication routes.

#### Scenario: Privileged account has not enrolled MFA

- **WHEN** an admin, moderator, or welcome-team member signs in without MFA
- **THEN** the system restricts the session to the authenticator setup flow
- **AND** the account cannot access privileged routes

#### Scenario: Privileged account has not verified this session

- **WHEN** an MFA-enabled privileged member has not completed a second factor
  for the current session
- **THEN** the system denies privileged routes until the member verifies a TOTP
  or unused recovery code

#### Scenario: Privileged role is removed

- **WHEN** a member's privileged role is removed
- **THEN** the next request authorises the member using the current roles only
