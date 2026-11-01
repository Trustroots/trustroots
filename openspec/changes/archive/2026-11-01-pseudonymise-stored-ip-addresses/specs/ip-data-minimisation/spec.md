## ADDED Requirements

### Requirement: Persist only keyed address identifiers

Authenticated activity SHALL store only an HMAC-SHA-256 identifier of the canonical client address, using a dedicated secret outside MongoDB. Equivalent IPv6 and mapped IPv4 forms SHALL match. Missing or invalid addresses SHALL not create identifiers. Without a configured secret, address collection SHALL be disabled. Raw request addresses SHALL remain available for transient location lookups.

#### Scenario: Account uses an equivalent address representation

- **WHEN** authenticated requests use equivalent address representations
- **THEN** the stored identifier is identical
- **AND** no raw address is written to the user record

### Requirement: Match accounts without displaying addresses

Administrators SHALL be able to find accounts sharing an address identifier. Admin user responses SHALL exclude legacy raw address fields, and matching actions SHALL display descriptive text instead of addresses or hashes.

#### Scenario: Administrator follows a matching action

- **WHEN** an administrator selects the same-IP action on a member
- **THEN** only accounts with the same stored identifier are returned
- **AND** the interface does not display the raw address

### Requirement: Migrate existing address data

An idempotent maintenance script SHALL support a dry run, replace existing user addresses with identifiers, and remove legacy staff address fields and IP-search payloads from audit records. New audit entries SHALL use a keyed address identifier. Migration SHALL not overwrite a concurrently refreshed identifier. Deployment documentation SHALL explain key management and the limits concerning backups and infrastructure logs.

#### Scenario: Migration is applied twice

- **WHEN** the maintenance script is applied repeatedly with the configured key
- **THEN** legacy raw address fields are removed
- **AND** existing identifiers remain unchanged
