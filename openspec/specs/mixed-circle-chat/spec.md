# mixed-circle-chat Specification

## Purpose

Let Trustroots members share a room through the authenticated relay, whether
they sign their own messages or use their Trustroots account.

## Requirements

### Requirement: Chat on the authenticated Trustroots relay

Trustroots SHALL serve Hackers, Volunteering, Radio and Hitchhikers chat from
`wss://nip42.trustroots.org` and publish web chat events only to that relay. Access
in Trustroots SHALL require an eligible signed-in account. The existing topics
SHALL continue to display member-signed events. Server-signed attribution SHALL
be displayed only for events signed by the Trustroots service key.

Reading and posting in the Hackers, Hitchhikers and Radio web rooms SHALL
require current membership of the corresponding circle. Any eligible signed-in
account SHALL be able to read and post in the Volunteering web room.

Deployments SHALL use the shared Nostr service identity. The relay SHALL
accept the domain identity subject to its existing profile and NIP-05 checks.

#### Scenario: An eligible member posts from Trustroots

- **WHEN** an eligible member who meets the room’s posting requirements sends a valid message
- **THEN** Trustroots signs it with the service key and includes attribution derived from the session, regardless of whether the member has a linked key
- **AND** the web room does not request browser-extension permissions

#### Scenario: A member posts with their linked signer

- **WHEN** a chat event signed by a member is published to the room from an external Nostr client
- **THEN** the Trustroots web room can still display it under that member's public key

#### Scenario: A member posts without a linked key

- **WHEN** an eligible member without a linked key submits a valid web chat message in a room where they can post
- **THEN** Trustroots signs it with the service key, includes attribution derived from the session, and publishes it to the same room

#### Scenario: Chat history fails to load

- **WHEN** an authorised member's history request fails
- **THEN** the room offers to retry loading and keeps any already loaded messages visible

#### Scenario: A message fails to send

- **WHEN** a member's message fails to send
- **THEN** the room displays a send error and retains the draft

#### Scenario: A signed-in account has not joined the circle

- **WHEN** an eligible signed-in account views a circle chat before joining
- **THEN** the room explains how to join without displaying or requesting chat history
- **AND** the server rejects attempts to read or post on behalf of that account

#### Scenario: An eligible account posts in Volunteering

- **WHEN** an eligible signed-in account submits a valid Volunteering chat message
- **THEN** Trustroots signs and publishes it regardless of circle membership
