## ADDED Requirements

### Requirement: Publish a featured Nostr note from admin

Trustroots SHALL let administrators compose a public Nostr kind 1 text note on the Nostr admin page and sign it with a NIP-07 browser signer. Trustroots SHALL verify the signature, author and requested contents before publishing to the supported relays. The page SHALL feature the signed note only after at least one relay acknowledges publication.

#### Scenario: Publish and feature an update

- **WHEN** an administrator submits a note and approves signing with their NIP-07 signer
- **AND** a supported relay acknowledges the signed event
- **THEN** Trustroots features that event on the homepage with its Nostr attribution

#### Scenario: Retry a failed homepage save

- **WHEN** a relay acknowledges publication but the homepage save fails
- **THEN** the page reports that the note was published and allows the administrator to retry saving the same event without signing or publishing it again
