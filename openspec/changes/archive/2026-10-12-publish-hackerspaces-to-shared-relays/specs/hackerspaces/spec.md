## ADDED Requirements

### Requirement: Shared relay publication

Administrator-approved place events SHALL be signed once and published to both
`wss://relay.trustroots.org` and `wss://relay.nomadwiki.org`. The import UI SHALL
report each relay's outcomes independently and close publication connections
after the import. One unavailable relay SHALL NOT prevent publication to the other.

#### Scenario: Both relays accept a place

- **WHEN** a signer approves a place event and both relays accept it
- **THEN** the same signed event is sent to both relays
- **AND** both successful results are displayed

#### Scenario: One relay is unavailable

- **WHEN** one relay cannot connect or rejects publication
- **THEN** publication continues to the other relay
- **AND** the UI distinguishes their outcomes
