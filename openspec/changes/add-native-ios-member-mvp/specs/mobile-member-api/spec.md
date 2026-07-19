# Mobile Member API Specification

## Purpose

Expose the supported Trustroots member MVP to native applications without
coupling them to browser cookies or browser-only representations.

## ADDED Requirements

### Requirement: Versioned mobile API contract

The system SHALL expose the pre-release mobile member API under `/api/mobile/v0`,
document its request, response, error, pagination, and compatibility contract,
and report a development build identifier in the form
`v0.1-YYYYMMDDHHmm`. The system SHALL reserve `/api/mobile/v1` for a future
stable contract.

#### Scenario: App checks the deployed API build

- **WHEN** a client requests `GET /api/mobile/v0/status`
- **THEN** the server returns contract version `v0`
- **AND** returns the exact running build identifier and start datetime
- **AND** returns the deployed source revision when it is available
- **AND** does not require a member session

#### Scenario: Supported iOS client calls a mobile endpoint

- **WHEN** a supported iOS app makes a valid versioned API request
- **THEN** the system returns the documented mobile representation and status

#### Scenario: Client submits an invalid mobile request

- **WHEN** a mobile client submits invalid data or an unsupported request
- **THEN** the system returns a documented, usable error response

#### Scenario: Mobile representation evolves

- **WHEN** the server adds fields to a mobile representation within pre-release version 0
- **THEN** existing documented fields keep their meaning and type
- **AND** released clients can ignore the additive fields

### Requirement: Bearer-only native member access

All Trustroots member and data requests made by a native client SHALL use an
access token in the `Authorization: Bearer` header and SHALL NOT depend on an
Express browser-session cookie. Public map tiles, Nostr relays and pages shown
in the bounded website fallback are not mobile member API requests and SHALL
remain outside this bearer-token contract.

#### Scenario: Native client calls a member endpoint

- **WHEN** a native client calls a protected `/api/mobile/v0` member endpoint
- **THEN** the server authenticates the request from its bearer access token
- **AND** derives the current member from the corresponding mobile session

#### Scenario: Native client presents no valid access token

- **WHEN** a protected mobile request has no token or has an expired, revoked
  or unknown token
- **THEN** the server returns HTTP 401 with the stable mobile error code
  `authentication_required`

### Requirement: Website isolation

Mobile delivery SHALL be additive and SHALL NOT require changes to the normal
`www.trustroots.org` browser interface, browser-session authentication,
navigation, or assets. Mobile-specific server behaviour SHALL remain under the
pre-release `/api/mobile/v0` boundary. A reusable website fix MAY ship alongside
mobile work only when it is independently justified and tested as a website
change rather than being an implicit native-app dependency.

#### Scenario: Browser member uses Trustroots after mobile deployment

- **WHEN** the mobile API and native applications are deployed
- **THEN** existing website pages and browser authentication behave as before
- **AND** the browser does not need to load native-app code or mobile API
  representations

#### Scenario: Native client establishes a mobile session

- **WHEN** the native client signs in through `/api/mobile/v0/auth/signin`
- **THEN** the response does not establish or depend on an Express browser
  session cookie

#### Scenario: A web improvement is discovered during mobile work

- **WHEN** a change affects the rendered website or a legacy browser route
- **THEN** it is reviewed and tested as an explicit web change
- **AND** the native app remains functional without that rendered-website
  change unless the feature is intentionally using the bounded browser fallback

### Requirement: Rotating mobile session lifetime

The system SHALL issue access tokens valid for 15 minutes and rotating refresh
tokens valid for 30 days. The native client SHALL refresh without user action,
store both tokens only in platform-protected credential storage, and retry an
authorised request at most once after a successful refresh.

#### Scenario: Access token expires during normal use

- **WHEN** an otherwise valid request receives `authentication_required`
- **AND** the stored refresh token remains valid
- **THEN** the client rotates the token pair and retries that `/api/mobile/v0`
  request once

#### Scenario: Several requests observe one expired access token

- **WHEN** concurrent `/api/mobile/v0` requests receive
  `authentication_required` for the same access token
- **THEN** the client performs no more than one refresh-token rotation for the
  affected server
- **AND** each request retries at most once with the resulting credential pair

#### Scenario: Refresh token is no longer valid

- **WHEN** token rotation returns `authentication_required`
- **THEN** the client removes the unusable credential pair
- **AND** returns to sign-in with a clear explanation

#### Scenario: Suspended member presents a refresh token

- **WHEN** a refresh token belongs to a member who is no longer eligible to
  sign in
- **THEN** the server rejects the refresh before changing either stored token
- **AND** the previously stored session remains unusable

### Requirement: Mobile authentication abuse protection

The system SHALL throttle repeated mobile sign-in and refresh attempts using
an application-enforced, time-bounded limit that does not store credentials or
raw tokens. Successful authentication SHALL clear the corresponding failure
budget.

#### Scenario: Client repeatedly submits rejected credentials

- **WHEN** a client exceeds ten rejected mobile authentication attempts within
  fifteen minutes for the same protected identity and network source
- **THEN** the server returns HTTP 429 with the stable mobile error code
  `rate_limited`
- **AND** includes a `Retry-After` response header

#### Scenario: Rejected attempts arrive concurrently

- **WHEN** more than ten rejected attempts for the same protected identity and
  network source arrive concurrently within the failure window
- **THEN** an atomic server-side budget prevents the concurrent requests from
  bypassing the limit

#### Scenario: Remote client spoofs an internal proxy header

- **WHEN** a non-loopback client supplies the Passenger client-address header
- **THEN** the server ignores that header when deriving the rate-limit identity

### Requirement: Expired mobile session cleanup

The system SHALL automatically remove mobile session records after their
30-day refresh-token expiry while retaining revoked sessions no longer than
that same expiry.

#### Scenario: Refresh lifetime has elapsed

- **WHEN** MongoDB's expiry monitor processes a mobile session whose
  `refreshExpiresAt` is in the past
- **THEN** the session record is deleted

### Requirement: Incrementally stable mobile representations

The system SHALL introduce purpose-built mobile response objects rather than
making raw database documents or legacy browser payloads part of the mobile
compatibility contract. The migration MAY be delivered resource by resource;
until a stable mobile resource exists, the corresponding native feature SHALL
remain tracked as incomplete rather than silently relying on browser cookies.

#### Scenario: Resource receives a stable mobile representation

- **WHEN** a profile, contact, circle, offer, message, experience, account or
  support resource is added to `/api/mobile/v0`
- **THEN** its documented mobile object contains only fields required by the
  native journey
- **AND** server-side visibility and mutation policies remain authoritative

### Requirement: Stable mobile session representation

The pre-release version 0 sign-in and refresh responses SHALL contain opaque
`accessToken` and `refreshToken` strings, an ISO 8601
`accessTokenExpiresAt` value, and a `member` object. The current-member
response SHALL contain the same `member` object. That object SHALL expose only
the member `id`, `username`, `displayName`, `public`, `email`, and `newsletter`
fields until further fields are added to the documented pre-release contract.

#### Scenario: Native client establishes a session

- **WHEN** valid credentials or a valid refresh token establish a mobile
  session
- **THEN** the server returns the documented token and current-member fields
- **AND** does not expose password hashes, roles, moderation state, or raw
  database fields
- **AND** marks the token-bearing response as non-cacheable

### Requirement: Member feature access

The system SHALL provide authorised mobile access to current-member and
profile data, profile photos, circles and memberships, offer search and offer
management, and messaging. It SHALL enforce the website's visibility,
blocking, confirmation, and moderation rules for every mobile response.

#### Scenario: Member reads a protected mobile resource

- **WHEN** an eligible member requests a mobile resource that they are allowed
  to view
- **THEN** the system returns the authorised representation

#### Scenario: Member requests a protected mobile resource they cannot view

- **WHEN** a member requests a mobile resource hidden by Trustroots privacy,
  blocking, or moderation rules
- **THEN** the system does not expose the protected data

#### Scenario: Native MVP reaches full bearer coverage

- **WHEN** the bearer migration is complete
- **THEN** current member, profiles, contacts, circles and memberships, offers,
  messages, experiences, account settings and support use versioned mobile
  endpoints
- **AND** no native request to those resources requires a browser cookie

### Requirement: Bounded offer and message retrieval

The system SHALL bound mobile offer-search and conversation-history responses
and SHALL provide pagination metadata where a result can span multiple pages.

#### Scenario: Member opens a long conversation

- **WHEN** a member opens a conversation with more messages than one mobile
  response may contain
- **THEN** the system returns an initial page and metadata that lets the app
  request the remaining authorised messages
