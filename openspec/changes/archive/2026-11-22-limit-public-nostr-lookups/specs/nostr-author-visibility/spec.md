## ADDED Requirements

### Requirement: Independent public Nostr lookup allowances

The author visibility and NIP-05 endpoints SHALL enforce separate request allowances per client address. An endpoint SHALL respond with HTTP 429 and a Retry-After header when its allowance is exhausted.

#### Scenario: An author visibility client reaches its allowance

- **WHEN** a client exhausts its author visibility allowance and requests optional profiles
- **THEN** the service returns HTTP 429 with Retry-After and private, no-store cache control
- **AND** a NIP-05 lookup from the same client still has its own allowance

#### Scenario: A NIP-05 client reaches its allowance

- **WHEN** a client exhausts its NIP-05 allowance
- **THEN** the service returns HTTP 429 with Retry-After and retains its cross-origin response header
