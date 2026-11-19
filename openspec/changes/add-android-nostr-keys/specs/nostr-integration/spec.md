## ADDED Requirements

### Requirement: Android local Nostr identities

The Android Account screen SHALL let signed-in members generate or import a
valid Nostr private key, copy the local public key, and reveal the private key
after device credential authentication. The app SHALL store one encrypted key
per normalised server and member using Android Keystore. Confirmed local removal
SHALL leave the profile link untouched. Sign-out SHALL retain the encrypted key
and end access from the signed-out screen.

#### Scenario: Member switches accounts

- **WHEN** a different member or server signs in
- **THEN** only its local public key can be displayed or backed up
- **AND** returning to the first account restores its local key

#### Scenario: Member manages an Android key

- **WHEN** a signed-in member generates or imports a key
- **THEN** the manager displays its local npub and the profile-linked npub separately
- **AND** it only reveals the local nsec after device authentication
- **AND** local removal requires confirmation and leaves the profile link untouched
