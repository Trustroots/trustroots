## ADDED Requirements

### Requirement: Chat on the authenticated Trustroots relay

Trustroots SHALL serve Hackers, Volunteering, Radio and Hitchhikers chat from
`wss://nip42.trustroots.org` and publish chat events only to that relay. Access
in Trustroots SHALL require an eligible signed-in account.

#### Scenario: A member posts with their linked signer

- **WHEN** a member posts using their verified linked Nostr signer
- **THEN** the event is published with their own pubkey to the authenticated relay

#### Scenario: A member posts without a linked key

- **WHEN** an eligible member without a linked key submits a valid chat message
- **THEN** Trustroots signs it with its export signing key, includes attribution
  derived from the session, and publishes it to the same room
