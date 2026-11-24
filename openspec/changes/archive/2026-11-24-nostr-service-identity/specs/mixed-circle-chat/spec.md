## MODIFIED Requirements

### Requirement: Chat on the authenticated Trustroots relay

Trustroots SHALL serve Hackers, Volunteering, Radio and Hitchhikers chat from
`wss://nip42.trustroots.org` and publish chat events only to that relay. Access
in Trustroots SHALL require an eligible signed-in account. The same room topic
SHALL be used for both signing paths. Server-signed attribution SHALL be
displayed only for events signed by the Trustroots service key.

Deployments SHALL use the shared Nostr service identity. The relay SHALL
accept the domain identity subject to its existing profile and NIP-05 checks.

#### Scenario: A member posts with their linked signer

- **WHEN** a member posts using their verified linked Nostr signer
- **THEN** the event is published with their own pubkey to the authenticated relay

#### Scenario: A member posts without a linked key

- **WHEN** an eligible member without a linked key submits a valid chat message
- **THEN** Trustroots signs it with its service signing key, includes attribution
  derived from the session, and publishes it to the same room
