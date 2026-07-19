## ADDED Requirements

### Requirement: Pre-release API build identity

The server SHALL provide unauthenticated `GET /api/mobile/v0/status` metadata
with contract version `v0`, a build identifier formatted as
`v0.1-YYYYMMDDHHmm`, the server start datetime, and the source revision when
available. The `/api/mobile/v1` namespace SHALL remain reserved for a future
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
