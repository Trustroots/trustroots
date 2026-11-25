## ADDED Requirements

### Requirement: Publish the linked NIP-05 address to Nostr

The network editor SHALL publish member-signed kind 0 metadata to
`wss://nip42.trustroots.org` using NIP-42 authentication after saving a newly
linked key with a connected signer and verifying that the public Trustroots
NIP-05 lookup maps the member's username to that key. It SHALL preserve the
other fields of the latest metadata available on the Trustroots relays.

#### Scenario: Public identity is linked with a connected signer

- **WHEN** the network editor saves a new key and the public lookup matches it
- **THEN** the editor authenticates with the linked key and publishes signed
  kind 0 metadata containing `username@trustroots.org`
- **AND** it reports publication after relay acknowledgement

#### Scenario: No public mapping is available

- **WHEN** the public lookup does not map the member's username to the saved key
- **THEN** the editor does not publish metadata

#### Scenario: Publication requires a separate attempt

- **WHEN** the member linked a key using an external ownership proof or
  publication could not complete
- **THEN** the saved association remains in place
- **AND** the member can publish separately with a connected signer
