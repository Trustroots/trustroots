## ADDED Requirements

### Requirement: Targeted limits for account access requests

The system SHALL enforce configurable, shared request limits for sign-in, password recovery and confirmation-resend operations. Limits SHALL use a trusted client address together with a keyed account-identifier digest where an account identifier is supplied, so an attacker cannot lock an account by submitting requests from unrelated clients. The system SHALL not rely on caller-supplied forwarding headers for the client address.

#### Scenario: Client exceeds an account-access policy

- **WHEN** a client exceeds a configured sign-in, recovery or confirmation-resend limit within its window
- **THEN** the request is rejected with HTTP 429 and a `Retry-After` header

#### Scenario: Requests are spread across application instances

- **WHEN** requests for the same applicable client and account key reach different application instances during one window
- **THEN** the shared counter enforces the same limit across those instances

#### Scenario: A caller supplies a forged forwarding header

- **WHEN** a caller supplies an untrusted `X-Forwarded-For` value
- **THEN** that value does not select the request's limiting client identity
