## ADDED Requirements

### Requirement: Session cookie security and persistence

The system SHALL issue session cookies with HttpOnly and SameSite=Lax. When
HTTPS is enabled, it SHALL mark session cookies Secure and issue them only for
HTTPS requests. Forwarded protocol headers SHALL be trusted for this decision
only when the session proxy setting is explicitly enabled. The system SHALL
not persist or issue cookies for uninitialised sessions, SHALL avoid rewriting
unchanged sessions, and SHALL refresh their expiry through the session store.

#### Scenario: Visitor makes an uninitialised request

- **WHEN** a visitor makes a request without changing session state
- **THEN** the system does not issue a session cookie or persist a session

#### Scenario: HTTPS session is changed

- **WHEN** a person changes session state through a verified HTTPS request
- **THEN** the system issues an HttpOnly, SameSite=Lax, Secure session cookie

#### Scenario: Forwarded protocol is not trusted by default

- **WHEN** a request over HTTP includes `X-Forwarded-Proto: https` while the
  session proxy setting is disabled
- **THEN** the system does not treat the request as HTTPS for session cookies

#### Scenario: Existing session remains unchanged

- **WHEN** a person makes a request without changing an existing session
- **THEN** the system refreshes the session expiry without rewriting the session

