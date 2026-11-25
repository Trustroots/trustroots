## MODIFIED Requirements

### Requirement: Authenticated social interface

Chat and listener identities SHALL be shown only to logged-in Trustroots
members. The interface SHALL NOT request chat history, fetch listener profiles,
or look up author identities for visitors.

#### Scenario: A member reads the room

- **WHEN** an eligible Trustroots member opens Radio
- **THEN** they can read chat, see listeners and post chat via Trustroots

#### Scenario: A visitor opens the room

- **WHEN** a visitor opens Radio
- **THEN** the interface does not request personalised author identity data

### Requirement: Radiostr compatibility

Radio SHALL read listening activity from the existing public Trustroots and
Nomadwiki relays. Listener counts SHALL deduplicate public keys and expire
activity after twelve minutes. Radio SHALL store favourites on the current
device. Radio chat SHALL use the existing kind-1 Radiostr tags, station IDs and
thirty-day expiry on the authenticated Trustroots relay.

#### Scenario: Both interfaces are in use

- **WHEN** Radiostr publishes listening activity to a supported public relay
- **THEN** the circle processes it using the same station identity
- **AND** duplicate relay deliveries do not duplicate listeners

#### Scenario: A member tunes in or saves a favourite

- **WHEN** a member listens or saves a favourite in Trustroots Radio
- **THEN** Radio does not request extension access or publish a listening or favourite event

## REMOVED Requirements

### Requirement: Matching verified signing identity

**Reason**: Web room chat uses the Trustroots service signer and Radio listens to public relay activity.
**Migration**: Web users can post with their Trustroots session. Favourites already stored on the current device remain available.
