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

### Requirement: Multi-factor verification for privileged roles

Administrator access SHALL require an MFA-enabled account and a session that
has completed second-factor verification. Admin routes SHALL treat an
unenrolled or unverified session as an ordinary member. An administrator who
is not enrolled SHALL be restricted to authenticator setup, sign-out, and
necessary anonymous/authentication routes. Moderator and welcome-team access
does not require MFA.

#### Scenario: Privileged account has not enrolled MFA

- **WHEN** an administrator signs in without MFA
- **THEN** the system restricts the session to the authenticator setup flow
- **AND** the account cannot access admin routes

#### Scenario: Privileged account has not verified this session

- **WHEN** an MFA-enabled privileged member has not completed a second factor
  for the current session
- **THEN** the system denies privileged routes until the member verifies a TOTP
  or unused recovery code

#### Scenario: Privileged role is removed

- **WHEN** a member's privileged role is removed
- **THEN** the next request authorises the member using the current roles only
