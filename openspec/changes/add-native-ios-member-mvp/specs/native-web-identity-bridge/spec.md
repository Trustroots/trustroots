## ADDED Requirements

### Requirement: Verified Nostr browser sign-in

The system SHALL authenticate a browser session from a Nostr key only after it
verifies a short-lived, origin-bound challenge signature against the public key
associated with an eligible Trustroots member. It SHALL NOT authenticate a
member merely because a browser reports a public key.

#### Scenario: Associated member completes Nostr browser sign-in

- **WHEN** an eligible member's allowlisted native browser signs a valid,
  unexpired Trustroots challenge with the Nostr key associated with that member
- **THEN** the system creates a normal browser session for that member

#### Scenario: Browser reports an unassociated or invalid public key

- **WHEN** a browser supplies a public key without a valid matching challenge
  signature or without an eligible associated member
- **THEN** the system does not create a browser session
