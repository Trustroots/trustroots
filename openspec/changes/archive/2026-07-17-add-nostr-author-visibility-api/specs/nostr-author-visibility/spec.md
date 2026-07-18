# Nostr Author Visibility Specification

## Purpose

Allow community-note clients to determine whether a set of Nostr authors is
eligible for public display without revealing moderation state.

## ADDED Requirements

### Requirement: Batch author visibility lookup

The system SHALL provide a public read-only endpoint that accepts one or more
valid Nostr public-key hex values and returns only the keys associated with
eligible public Trustroots members.

#### Scenario: Lookup includes eligible and ineligible authors

- **WHEN** a client requests visibility for public, shadowbanned, and unknown
  Nostr public keys
- **THEN** the response includes the public member's key
- **AND** excludes the shadowbanned and unknown keys

#### Scenario: Lookup contains multiple valid keys

- **WHEN** a client submits multiple valid Nostr public keys within the batch
  limit
- **THEN** the response evaluates all submitted keys in one request

#### Scenario: Lookup contains no valid keys

- **WHEN** a client submits an invalid key or exceeds the batch limit
- **THEN** the endpoint rejects the request with a validation error
