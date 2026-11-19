## ADDED Requirements

### Requirement: Native Nostr profile linking with ownership proof

The mobile API SHALL expose the existing Nostr ownership challenge to authenticated
mobile members. The Android and iOS Account screens SHALL require an explicit action to link
the local key, confirm replacement of a different linked key, and confirm
unlinking independently of local removal. The app SHALL validate the challenge
kind, destination, method and nonce before signing with the active local key.

#### Scenario: Member explicitly links their local key

- **WHEN** the member links or confirms replacement with their local key
- **THEN** the app obtains and signs a fresh challenge for the configured server
- **AND** the API applies its existing proof and duplicate-key checks
- **AND** the displayed profile key updates after the request succeeds

#### Scenario: Member unlinks the profile key

- **WHEN** the member confirms removal of the profile link
- **THEN** the profile key is cleared
- **AND** the encrypted local key stays available
