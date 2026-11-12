## ADDED Requirements

### Requirement: Guided Nostr profile linking

The profile networks editor SHALL offer NIP-07 as the primary linking method when a browser signer is available. Otherwise it SHALL offer NIP-46 pairing via a QR code and a link to open a compatible signer app. Linking SHALL require a member action and use a fresh server challenge for the key supplied by the signer.

#### Scenario: Link through a browser signer

- **WHEN** a member chooses to link with their available browser signer
- **THEN** the editor obtains the signer's public key, requests a challenge for that key, and asks the signer to sign it
- **AND** the editor saves the public key with the signed proof

#### Scenario: Pair a remote signer

- **WHEN** a member starts remote pairing
- **THEN** the editor provides an expiring NIP-46 connection as a QR code and an app link
- **AND** after pairing it requests and signs a fresh challenge for the signer's key
- **AND** cancelling pairing closes the connection and leaves the profile unchanged
