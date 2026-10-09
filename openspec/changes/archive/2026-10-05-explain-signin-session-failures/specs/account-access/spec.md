## ADDED Requirements

### Requirement: Sign-in session confirmation

After accepting sign-in credentials, the client SHALL confirm through a subsequent
non-cacheable request that the server recognises the same account before updating
its authenticated state or redirecting. The session endpoint SHALL return only the
current account identifier, or null for anonymous requests, without initialising
an anonymous session. Session cookie security settings SHALL remain unchanged.

#### Scenario: Session persists after sign-in

- **WHEN** credentials are accepted and the subsequent request identifies the same account
- **THEN** the client completes sign-in and preserves the intended destination

#### Scenario: Session is missing or belongs to a different account

- **WHEN** credentials are accepted but the subsequent request does not identify the same account
- **THEN** the client stays on the sign-in form and explains that a cookie or site problem prevented keeping the person signed in
- **AND** the form allows another attempt without treating the credentials as invalid

#### Scenario: Session verification request fails

- **WHEN** credentials are accepted but the subsequent session request fails
- **THEN** the client explains that it could not check the session and offers a retry
- **AND** it does not claim cookies are blocked or redirect
