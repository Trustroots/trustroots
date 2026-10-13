## ADDED Requirements

### Requirement: Staff passkey registration

The system SHALL let eligible staff register and manage optional WebAuthn credentials after fresh password and existing second-factor verification. It SHALL store public credential material and an opaque user handle, and SHALL preserve an available recovery method.

#### Scenario: Verified staff member registers a passkey

- **WHEN** a staff member completes a valid registration ceremony with required user verification
- **THEN** the system stores a uniquely owned credential with a member-selected label
- **AND** no authenticator private key is received or stored

#### Scenario: Member attempts to remove the final available method

- **WHEN** removal would leave the account without a usable sign-in or documented recovery method
- **THEN** the operation is refused with actionable feedback

### Requirement: Verified passkey second factor

The system SHALL accept a passkey as a second factor only after server verification of origin, relying-party ID, ceremony challenge, ownership, signature and user verification. Challenges SHALL expire within five minutes and be atomically single-use.

#### Scenario: Password-first sign-in uses a passkey

- **WHEN** a member completes the current password-first passkey challenge
- **THEN** the resulting session satisfies the same second-factor policy as an accepted authenticator code

#### Scenario: Ceremony does not match its account or deployment

- **WHEN** a response is expired, replayed, unverified or bound to another member, origin or relying party
- **THEN** it does not establish a verified session
