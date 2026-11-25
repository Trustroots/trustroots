## MODIFIED Requirements

### Requirement: Chat on the authenticated Trustroots relay

Trustroots SHALL serve Hackers, Volunteering, Radio and Hitchhikers chat from
`wss://nip42.trustroots.org` and publish web chat events only to that relay. Access
in Trustroots SHALL require an eligible signed-in account. The existing topics
SHALL continue to display member-signed events. Server-signed attribution SHALL
be displayed only for events signed by the Trustroots service key.

Deployments SHALL use the shared Nostr service identity. The relay SHALL
accept the domain identity subject to its existing profile and NIP-05 checks.

#### Scenario: An eligible member posts from Trustroots

- **WHEN** an eligible member sends a valid message from one of the web rooms
- **THEN** Trustroots signs it with the service key and includes attribution derived from the session, regardless of whether the member has a linked key
- **AND** the web room does not request browser-extension permissions

#### Scenario: A member posts with their linked signer

- **WHEN** a chat event signed by a member is published to the room from an external Nostr client
- **THEN** the Trustroots web room can still display it under that member's public key

#### Scenario: A member posts without a linked key

- **WHEN** an eligible member without a linked key submits a valid web chat message
- **THEN** Trustroots signs it with the service key, includes attribution derived from the session, and publishes it to the same room

#### Scenario: Chat history fails to load

- **WHEN** a signed-in member's history request fails
- **THEN** the room offers to retry loading and keeps any already loaded messages visible

#### Scenario: A message fails to send

- **WHEN** a member's message fails to send
- **THEN** the room displays a send error and retains the draft
