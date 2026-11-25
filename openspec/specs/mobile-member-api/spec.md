# Mobile Member API Specification

## Purpose

Provide versioned bearer authentication and rotating sessions for native member clients.

## Requirements

### Requirement: Pre-release API build identity

The server SHALL provide unauthenticated `GET /api/mobile/v0/status` metadata
with contract version `v0`, a build identifier formatted as
`v0.1-YYYYMMDDHHmm` and the server start datetime. The `/api/mobile/v1`
namespace SHALL remain reserved for a future
stable contract.

#### Scenario: Native client checks compatibility

- **WHEN** a native client requests the mobile status endpoint
- **THEN** it can identify the exact pre-release API instance before signing in
- **AND** the response does not establish a browser session

### Requirement: Mobile token sign-in

The server SHALL provide `POST /api/mobile/v0/auth/signin` for an existing
member to exchange a username or email and password for opaque mobile tokens.
The response SHALL include a short-lived access token, a refresh token and the
authenticated member's safe profile representation. The server MUST NOT store
either raw token.

#### Scenario: Successful mobile sign-in

- **WHEN** a non-suspended member submits valid local credentials
- **THEN** the server responds with an access token, refresh token and member
  profile

#### Scenario: Invalid credentials

- **WHEN** credentials do not identify a valid local member
- **THEN** the server responds with a generic authentication failure

### Requirement: Refresh token rotation

The server SHALL provide `POST /api/mobile/v0/auth/refresh`. A valid refresh
token SHALL be single-use: after a successful refresh, the old refresh token
MUST no longer authenticate a request.

#### Scenario: Refreshing a session

- **WHEN** a client presents an unexpired refresh token
- **THEN** the server returns new access and refresh tokens
- **AND** rejects the prior refresh token thereafter

#### Scenario: Replayed refresh token

- **WHEN** a client presents a refresh token that was already rotated
- **THEN** the server revokes the associated mobile session
- **AND** rejects its current access and refresh tokens

### Requirement: Token-authenticated member identity

The server SHALL provide `GET /api/mobile/v0/me` authenticated with an access
token in the `Authorization: Bearer` header.

#### Scenario: Valid access token

- **WHEN** the request has a current, unrevoked access token
- **THEN** the server responds with the authenticated member's safe profile
  representation, including their email address

#### Scenario: Missing or expired access token

- **WHEN** the access token is absent, invalid, revoked or expired
- **THEN** the server responds with HTTP 401

### Requirement: iOS can edit its own host offer

The iOS app SHALL provide an own-profile editor for hosting, ongoing meeting
availability, volunteering, descriptions, guest count, circle visibility and
location, using the authenticated mobile offer endpoints. An existing offer
SHALL preload its saved coordinates. A new offer SHALL require a member-chosen
location. An empty list or HTTP 404 from offers-by SHALL open a new offer.
Other load failures SHALL keep the form unavailable until retry.

#### Scenario: Save a meeting-only offer

- **GIVEN** a signed-in member opens their hosting editor
- **WHEN** the member chooses No for hosting, enables ongoing meetings and
  saves with a valid location
- **THEN** the client saves one host offer with those separate statuses
- **AND** retains the server offer identifier for subsequent updates.
