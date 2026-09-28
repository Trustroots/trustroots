## ADDED Requirements

### Requirement: Session cookies and persistence

HTTPS deployments SHALL issue Secure, HttpOnly, SameSite=Lax session cookies. HTTP development SHALL retain sign-in support. The session middleware SHALL trust forwarded protocol only when the explicit HTTPS configuration is enabled. Untouched anonymous requests SHALL NOT persist sessions, and unchanged authenticated requests SHALL refresh expiry without rewriting session data.

#### Scenario: Existing supported requests

- **WHEN** a client makes a supported request
- **THEN** the response follows the approved session cookies and persistence contract
