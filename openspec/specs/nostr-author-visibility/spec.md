# nostr-author-visibility Specification

## Purpose

TBD - created by archiving change add-nostr-author-visibility-api. Update Purpose after archive.

## Requirements

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

### Requirement: Optional profile usernames

The batch author visibility endpoint SHALL return a mapping from eligible
public-key hex values to Trustroots usernames when a signed-in member requests
`profiles=1`. The response SHALL omit usernames for ineligible or unlinked keys
and SHALL omit the mapping for anonymous requests and requests without the option.

#### Scenario: A signed-in member requests profile usernames

- **WHEN** a signed-in member requests profile usernames for a batch of keys
- **THEN** the response includes usernames for eligible public authors only

#### Scenario: A visitor requests profile usernames

- **WHEN** an anonymous visitor requests profile usernames
- **THEN** the response includes only the ordinary author visibility fields
