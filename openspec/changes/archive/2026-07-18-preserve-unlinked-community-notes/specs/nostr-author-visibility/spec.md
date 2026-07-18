## MODIFIED Requirements

### Requirement: Batch author visibility lookup

The system SHALL provide a public read-only endpoint that accepts one or more
valid Nostr public-key hex values and identifies which keys are linked to
Trustroots members and which linked keys are eligible for public display. The
response SHALL NOT disclose why a linked key is ineligible.

#### Scenario: Lookup includes eligible and ineligible authors

- **WHEN** a client requests visibility for public, shadowbanned, and unknown Nostr public keys
- **THEN** the response identifies the public and shadowbanned keys as linked
- **AND** includes only the public member's key as eligible
- **AND** does not disclose why the shadowbanned key is ineligible

#### Scenario: Lookup contains multiple valid keys

- **WHEN** a client submits multiple valid Nostr public keys within the batch limit
- **THEN** the response evaluates all submitted keys in one request

#### Scenario: Lookup contains no valid keys

- **WHEN** a client submits an invalid key or exceeds the batch limit
- **THEN** the endpoint rejects the request with a validation error
