# mixed-circle-chat Specification

## Purpose

Let Trustroots members share a room through the authenticated relay, whether
they sign their own messages or use their Trustroots account.

## Requirements

### Requirement: Chat on the authenticated Trustroots relay

Trustroots SHALL serve Hackers, Volunteering, Radio and Hitchhikers chat from
`wss://nip42.trustroots.org` and publish chat events only to that relay. Access
in Trustroots SHALL require an eligible signed-in account. The same room topic
SHALL be used for both signing paths. Server-signed attribution SHALL be
displayed only for events signed by the Trustroots export key.

Deployments SHALL provide the existing signed-export key via the server-only
`TRUSTROOTS_NOSTR_EXPORT_NSEC` variable. Its public key SHALL be eligible to
authenticate to the relay through Trustroots NIP-05.

#### Scenario: A member posts with their linked signer

- **WHEN** a member posts using their verified linked Nostr signer
- **THEN** the event is published with their own pubkey to the authenticated relay

#### Scenario: A member posts without a linked key

- **WHEN** an eligible member without a linked key submits a valid chat message
- **THEN** Trustroots signs it with its export signing key, includes attribution
  derived from the session, and publishes it to the same room
