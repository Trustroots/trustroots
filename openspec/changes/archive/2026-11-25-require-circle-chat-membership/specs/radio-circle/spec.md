## MODIFIED Requirements

### Requirement: Authenticated social interface

Only eligible signed-in members of the Radio circle SHALL have access to chat.
Listener identities SHALL be shown only to signed-in Trustroots members. The
interface SHALL NOT fetch listener profiles or look up author identities for
visitors.

#### Scenario: A member reads the room

- **WHEN** an eligible Trustroots member opens Radio
- **THEN** they can see listeners
- **AND** after joining Radio they can read and post in chat via Trustroots

#### Scenario: A visitor opens the room

- **WHEN** a visitor opens Radio
- **THEN** the interface does not request personalised author identity data
